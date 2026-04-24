#!/usr/bin/env bash
# Smoke test end-to-end contra la API local.
#
# Pre-requisitos:
#   1. pnpm db:up            (Postgres + Redis en Docker)
#   2. pnpm --filter @inmobiliaria/api exec prisma migrate dev --name init
#   3. pnpm --filter @inmobiliaria/api db:postgis-triggers
#   4. pnpm --filter @inmobiliaria/api prisma:seed
#   5. pnpm --filter @inmobiliaria/api dev     (en otra terminal)
#
# Corré con:
#   bash scripts/smoke-test.sh
#
# Variables de entorno opcionales:
#   API_URL           default http://localhost:3001/api
#   SUPER_ADMIN_EMAIL default admin@miapp.com
#   SUPER_ADMIN_PASSWORD default "change-me-super-secret-12chars"
#
# Requiere jq. En Ubuntu: sudo apt-get install -y jq

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@miapp.com}"
ADMIN_PASS="${SUPER_ADMIN_PASSWORD:-change-me-super-secret-12chars}"

TENANT_SLUG="smoke-$(date +%s)"
TENANT_NAME="Smoke Test Inmobiliaria"
OWNER_EMAIL="owner-$(date +%s)@smoke.test"
OWNER_PASS="Smoke12345!"

COOKIE_ADMIN=$(mktemp)
COOKIE_USER=$(mktemp)
TMP_IMAGE=$(mktemp --suffix=.jpg)
trap 'rm -f "$COOKIE_ADMIN" "$COOKIE_USER" "$TMP_IMAGE"' EXIT

say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()  { printf "\033[1;32m  ✔ %s\033[0m\n" "$*"; }
fail(){ printf "\033[1;31m  ✘ %s\033[0m\n" "$*"; exit 1; }

command -v jq >/dev/null || fail "jq no instalado. sudo apt-get install -y jq"

# 1×1 JPEG válido (mínimo) — base64 conocido.
JPEG_B64="/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ//2Q=="
echo "$JPEG_B64" | base64 -d > "$TMP_IMAGE"

say "1. Health check"
curl -sSf "$API_URL/health" | jq -e '.status == "ok"' >/dev/null && ok "API viva" || fail "API no responde"

say "2. Login de super-admin"
ADMIN_RES=$(curl -sS -c "$COOKIE_ADMIN" -X POST "$API_URL/platform-admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$ADMIN_RES" | jq -r '.tokens.accessToken')
[ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ] && ok "Access token obtenido" || fail "Login falló: $ADMIN_RES"

say "3. Crear tenant + OWNER"
CREATE_TENANT=$(curl -sS -X POST "$API_URL/platform-admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg s "$TENANT_SLUG" --arg n "$TENANT_NAME" \
         --arg oe "$OWNER_EMAIL" --arg op "$OWNER_PASS" \
         '{slug:$s,name:$n,ownerEmail:$oe,ownerPassword:$op,ownerFirstName:"Owner",ownerLastName:"Smoke",city:"La Paz"}')")
TENANT_ID=$(echo "$CREATE_TENANT" | jq -r '.tenant.id')
[ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ] && ok "Tenant creado id=$TENANT_ID slug=$TENANT_SLUG" || fail "Create tenant falló: $CREATE_TENANT"

say "4. Login del OWNER"
LOGIN_RES=$(curl -sS -c "$COOKIE_USER" -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg t "$TENANT_SLUG" --arg e "$OWNER_EMAIL" --arg p "$OWNER_PASS" \
         '{tenantSlug:$t,email:$e,password:$p}')")
USER_TOKEN=$(echo "$LOGIN_RES" | jq -r '.tokens.accessToken')
[ -n "$USER_TOKEN" ] && [ "$USER_TOKEN" != "null" ] && ok "Login OWNER OK" || fail "Login OWNER falló: $LOGIN_RES"

say "5. GET /auth/me"
curl -sSf -H "Authorization: Bearer $USER_TOKEN" "$API_URL/auth/me" \
  | jq -e '.role == "OWNER"' >/dev/null && ok "me devuelve rol OWNER" || fail "me inconsistente"

say "6. Crear propiedad DRAFT"
CREATE_PROP=$(curl -sS -X POST "$API_URL/properties" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Casa de prueba en Achumani",
    "description": "Ambiente luminoso, cerca de colegios.",
    "operation": "SALE",
    "type": "HOUSE",
    "price": 185000,
    "currency": "USD",
    "areaSqm": 220,
    "bedrooms": 3,
    "bathrooms": 2,
    "parkingSpaces": 1,
    "city": "La Paz",
    "zone": "Achumani",
    "address": "Calle 20 S/N",
    "latitude": -16.552,
    "longitude": -68.079
  }')
PROP_ID=$(echo "$CREATE_PROP" | jq -r '.id')
PROP_SLUG=$(echo "$CREATE_PROP" | jq -r '.slug')
[ -n "$PROP_ID" ] && [ "$PROP_ID" != "null" ] && ok "Property id=$PROP_ID slug=$PROP_SLUG" || fail "Create property falló: $CREATE_PROP"

say "7. Publicar la propiedad"
PUB_RES=$(curl -sS -X PUT "$API_URL/properties/$PROP_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PUBLISHED"}')
echo "$PUB_RES" | jq -e '.status == "PUBLISHED" and .publishedAt != null' >/dev/null \
  && ok "Propiedad publicada" || fail "Publish falló: $PUB_RES"

say "8. Presign + PUT de imagen"
FILESIZE=$(wc -c < "$TMP_IMAGE")
PRESIGN=$(curl -sS -X POST "$API_URL/properties/$PROP_ID/images/presign" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"contentType\":\"image/jpeg\",\"contentLength\":$FILESIZE}")
UPLOAD_URL=$(echo "$PRESIGN" | jq -r '.uploadUrl')
R2_KEY=$(echo "$PRESIGN" | jq -r '.r2Key')
PUBLIC_URL=$(echo "$PRESIGN" | jq -r '.publicUrl')
CT=$(echo "$PRESIGN" | jq -r '.headers["Content-Type"]')
[ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ] && ok "Presign obtenido ($UPLOAD_URL)" || fail "Presign falló: $PRESIGN"

UPLOAD_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$UPLOAD_URL" \
  -H "Content-Type: $CT" \
  --data-binary "@$TMP_IMAGE")
[ "$UPLOAD_CODE" = "200" ] && ok "Upload OK ($UPLOAD_CODE)" || fail "PUT falló con $UPLOAD_CODE"

say "9. Confirmar imagen en DB"
CONFIRM=$(curl -sS -X POST "$API_URL/properties/$PROP_ID/images" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg k "$R2_KEY" --arg u "$PUBLIC_URL" \
         '{r2Key:$k,publicUrl:$u,order:0}')")
IMG_ID=$(echo "$CONFIRM" | jq -r '.id')
[ -n "$IMG_ID" ] && [ "$IMG_ID" != "null" ] && ok "Image id=$IMG_ID confirmada" || fail "Confirm falló: $CONFIRM"

say "10. GET admin /properties/:id incluye imagen"
curl -sSf -H "Authorization: Bearer $USER_TOKEN" "$API_URL/properties/$PROP_ID" \
  | jq -e '.images | length >= 1' >/dev/null && ok "Detalle admin con imagen" || fail "detalle sin imagen"

say "11. Marketplace público (global)"
PUB_LIST=$(curl -sS "$API_URL/public/properties?take=5")
echo "$PUB_LIST" | jq -e --arg id "$PROP_ID" '.items | map(.id) | index($id) != null' >/dev/null \
  && ok "Propiedad publicada visible en marketplace" || fail "no encontrada: $PUB_LIST"

say "12. Marketplace filtrado por tenant (X-Tenant-Slug)"
curl -sSf -H "X-Tenant-Slug: $TENANT_SLUG" "$API_URL/public/properties?take=5" \
  | jq -e --arg id "$PROP_ID" '.items | map(.id) | index($id) != null' >/dev/null \
  && ok "Filtrado por tenant OK" || fail "filtrado por tenant no devolvió la propiedad"

say "13. Detalle público por slug + tenantSlug"
curl -sSf "$API_URL/public/properties/$PROP_SLUG?tenantSlug=$TENANT_SLUG" \
  | jq -e --arg id "$PROP_ID" '.id == $id' >/dev/null \
  && ok "Detalle público OK" || fail "detalle público inconsistente"

say "14. Búsqueda geoespacial (radio 5km desde centro de Achumani)"
GEO=$(curl -sS "$API_URL/public/properties?nearLat=-16.552&nearLng=-68.079&radiusKm=5&take=5")
echo "$GEO" | jq -e --arg id "$PROP_ID" '.items | map(.id) | index($id) != null' >/dev/null \
  && ok "Geo search devolvió la propiedad" || fail "geo search vacío: $GEO"

say "15. Aislamiento multi-tenant: crear 2do tenant y verificar que no ve la propiedad"
OTHER_SLUG="other-$(date +%s)"
OTHER_EMAIL="other-$(date +%s)@smoke.test"
curl -sSf -X POST "$API_URL/platform-admin/tenants" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg s "$OTHER_SLUG" --arg n "Other" --arg oe "$OTHER_EMAIL" \
         --arg op "OtherSecret12!" \
         '{slug:$s,name:$n,ownerEmail:$oe,ownerPassword:$op,ownerFirstName:"O",ownerLastName:"O"}')" >/dev/null
OTHER_TOKEN=$(curl -sS -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg t "$OTHER_SLUG" --arg e "$OTHER_EMAIL" --arg p "OtherSecret12!" \
         '{tenantSlug:$t,email:$e,password:$p}')" | jq -r '.tokens.accessToken')

COUNT_OTHER=$(curl -sS -H "Authorization: Bearer $OTHER_TOKEN" "$API_URL/properties" | jq '.total')
[ "$COUNT_OTHER" = "0" ] && ok "Tenant nuevo ve 0 propiedades (aislamiento OK)" \
  || fail "Tenant nuevo vio $COUNT_OTHER propiedades (FUGA CROSS-TENANT)"

GET_FOREIGN=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $OTHER_TOKEN" "$API_URL/properties/$PROP_ID")
[ "$GET_FOREIGN" = "404" ] && ok "GET propiedad ajena devuelve 404" \
  || fail "GET propiedad ajena devolvió $GET_FOREIGN (esperado 404)"

say "16. Crear lead público (form marketplace) con tenantSlug + propertyId"
PUBLIC_LEAD=$(curl -sS -X POST "$API_URL/public/leads" \
  -H 'Content-Type: application/json' \
  -H 'Referer: https://example.com/props/demo' \
  -d "$(jq -nc --arg t "$TENANT_SLUG" --arg p "$PROP_ID" \
         '{tenantSlug:$t, propertyId:$p, firstName:"Juan", lastName:"Pérez",
           email:"juan@example.com", phone:"+59170000000",
           message:"Me interesa, ¿aún está disponible?", source:"WEB"}')")
PUBLIC_LEAD_ID=$(echo "$PUBLIC_LEAD" | jq -r '.id')
[ -n "$PUBLIC_LEAD_ID" ] && [ "$PUBLIC_LEAD_ID" != "null" ] \
  && ok "Lead público creado id=$PUBLIC_LEAD_ID" || fail "Public lead falló: $PUBLIC_LEAD"

say "17. Lead público sin contacto válido → 400"
NOCONTACT=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL/public/leads" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg t "$TENANT_SLUG" '{tenantSlug:$t, firstName:"SinContacto"}')")
[ "$NOCONTACT" = "400" ] && ok "Sin email ni phone → 400" \
  || fail "Sin contacto devolvió $NOCONTACT (esperado 400)"

say "18. Admin lista leads del tenant"
LEADS_LIST=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API_URL/leads?take=20")
echo "$LEADS_LIST" | jq -e --arg id "$PUBLIC_LEAD_ID" \
  '.items | map(.id) | index($id) != null' >/dev/null \
  && ok "Lead visible en /leads" || fail "Lead no aparece en admin: $LEADS_LIST"

say "19. Detalle del lead incluye actividad CREATED"
DETAIL=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API_URL/leads/$PUBLIC_LEAD_ID")
echo "$DETAIL" | jq -e '.activities | map(.kind) | index("CREATED") != null' >/dev/null \
  && ok "Actividad CREATED presente" || fail "No hay CREATED: $DETAIL"

say "20. Crear lead manual desde admin"
MANUAL_LEAD=$(curl -sS -X POST "$API_URL/leads" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Walkin","lastName":"Oficina","phone":"+59172000000",
       "source":"PHONE","status":"CONTACTED","message":"Llamó preguntando por terreno"}')
MANUAL_ID=$(echo "$MANUAL_LEAD" | jq -r '.id')
[ -n "$MANUAL_ID" ] && [ "$MANUAL_ID" != "null" ] \
  && ok "Lead manual id=$MANUAL_ID" || fail "Manual falló: $MANUAL_LEAD"

say "21. Patch status NEW → QUALIFIED y asignar al OWNER"
OWNER_USER_ID=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API_URL/auth/me" | jq -r '.id')
PATCHED=$(curl -sS -X PATCH "$API_URL/leads/$PUBLIC_LEAD_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$OWNER_USER_ID" \
         '{status:"QUALIFIED", assignedUserId:$u}')")
echo "$PATCHED" | jq -e '.status == "QUALIFIED" and .assignedUserId != null' >/dev/null \
  && ok "Status + asignación aplicados" || fail "Patch inconsistente: $PATCHED"

echo "$PATCHED" | jq -e '.activities | map(.kind) | (index("STATUS_CHANGE") != null) and (index("ASSIGNMENT") != null)' >/dev/null \
  && ok "Actividades STATUS_CHANGE + ASSIGNMENT emitidas" \
  || fail "Faltaron actividades automáticas: $(echo "$PATCHED" | jq '.activities | map(.kind)')"

say "22. Agregar actividad manual (CALL)"
ACT=$(curl -sS -X POST "$API_URL/leads/$PUBLIC_LEAD_ID/activities" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"CALL","body":"Llamada de 5 min, quiere visitar el sábado"}')
echo "$ACT" | jq -e '.kind == "CALL"' >/dev/null \
  && ok "Actividad CALL registrada" || fail "Activity falló: $ACT"

AFTER_CALL=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API_URL/leads/$PUBLIC_LEAD_ID")
echo "$AFTER_CALL" | jq -e '.lastContactedAt != null' >/dev/null \
  && ok "lastContactedAt actualizado" || fail "lastContactedAt no seteado"

say "23. Actividad con kind STATUS_CHANGE (reservado) → 403"
FORBIDDEN=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL/leads/$PUBLIC_LEAD_ID/activities" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"STATUS_CHANGE","body":"intento manual"}')
[ "$FORBIDDEN" = "403" ] && ok "Kinds automáticos bloqueados (403)" \
  || fail "STATUS_CHANGE manual devolvió $FORBIDDEN (esperado 403)"

say "24. Filtro ?assignedUserId=me"
MINE=$(curl -sS -H "Authorization: Bearer $USER_TOKEN" "$API_URL/leads?assignedUserId=me")
echo "$MINE" | jq -e --arg id "$PUBLIC_LEAD_ID" \
  '.items | map(.id) | index($id) != null' >/dev/null \
  && ok "Filtro assignedUserId=me devuelve el lead asignado" \
  || fail "Filtro me no funciona: $MINE"

say "25. Aislamiento multi-tenant en leads: OTHER no puede ver/leer el lead"
FOREIGN_COUNT=$(curl -sS -H "Authorization: Bearer $OTHER_TOKEN" "$API_URL/leads" | jq '.total')
[ "$FOREIGN_COUNT" = "0" ] && ok "OTHER ve 0 leads" \
  || fail "OTHER ve $FOREIGN_COUNT leads (FUGA CROSS-TENANT)"

GET_FOREIGN_LEAD=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $OTHER_TOKEN" "$API_URL/leads/$PUBLIC_LEAD_ID")
[ "$GET_FOREIGN_LEAD" = "404" ] && ok "GET lead ajeno devuelve 404" \
  || fail "GET lead ajeno devolvió $GET_FOREIGN_LEAD"

say "26. Borrar lead manual (role ADMIN+)"
DEL_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
  -H "Authorization: Bearer $USER_TOKEN" "$API_URL/leads/$MANUAL_ID")
[ "$DEL_CODE" = "204" ] && ok "Delete OK (204)" || fail "Delete devolvió $DEL_CODE"

say "27. Logout"
curl -sSf -b "$COOKIE_USER" -X POST "$API_URL/auth/logout" >/dev/null && ok "Logout OK"

printf "\n\033[1;32m✓ Smoke test completo. Tenant de prueba: %s (id=%s)\033[0m\n" "$TENANT_SLUG" "$TENANT_ID"
