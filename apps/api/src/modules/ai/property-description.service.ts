import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService, type AIProviderName } from './ai.service';

const TONE_HINTS: Record<string, string> = {
  commercial:
    'Tono comercial profesional, cálido pero no exagerado. Enfocate en beneficios concretos.',
  family:
    'Tono familiar y acogedor. Resaltá comodidad, seguridad y espacios para convivir.',
  investor:
    'Tono orientado a inversionistas. Mencioná rentabilidad potencial, ubicación estratégica y proyección.',
  luxury:
    'Tono premium y aspiracional. Resaltá acabados, exclusividad y calidad de vida.',
};

const OPERATION_LABEL: Record<string, string> = {
  SALE: 'venta',
  RENT: 'alquiler',
  ANTICRETICO: 'anticrético',
};

const TYPE_LABEL: Record<string, string> = {
  HOUSE: 'casa',
  APARTMENT: 'departamento',
  LAND: 'terreno',
  OFFICE: 'oficina',
  COMMERCIAL: 'local comercial',
  OTHER: 'inmueble',
};

interface GenerateOpts {
  provider?: AIProviderName;
  model?: string;
  tone?: string;
  approxWords?: number;
  notes?: string;
}

/**
 * Caso de uso específico: generar descripción comercial para una propiedad.
 * Toma los datos crudos del modelo Property y arma un prompt cuidado para que
 * el LLM produzca texto utilizable directamente en el aviso público.
 */
@Injectable()
export class PropertyDescriptionService {
  private readonly logger = new Logger(PropertyDescriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
  ) {}

  async generateForProperty(tenantId: string, propertyId: string, opts: GenerateOpts) {
    const property = await this.prisma.raw.property.findFirst({
      where: { id: propertyId, tenantId },
    });
    if (!property) throw new NotFoundException('Propiedad no encontrada');

    const tone = opts.tone ?? 'commercial';
    const approxWords = opts.approxWords ?? 150;

    const system = [
      'Sos un copywriter inmobiliario boliviano experimentado.',
      'Escribís en español rioplatense neutro, claro y vendedor sin exagerar.',
      `Apuntá a unas ${approxWords} palabras (±20%).`,
      'No inventes datos que no estén en el input. Si falta info, no la mencionés.',
      'Devolvé SOLO el texto del aviso, sin títulos, sin saludo, sin metadata.',
      'Estructura sugerida: 1 párrafo de gancho con el highlight + 1 párrafo con detalles + cierre con call-to-action breve.',
      TONE_HINTS[tone] ?? TONE_HINTS.commercial,
    ].join('\n');

    const facts: string[] = [];
    facts.push(`Operación: ${OPERATION_LABEL[property.operation] ?? property.operation}`);
    facts.push(`Tipo: ${TYPE_LABEL[property.type] ?? property.type}`);
    if (property.title) facts.push(`Título de referencia: ${property.title}`);
    if (property.price) facts.push(`Precio: ${property.price.toString()} ${property.currency}`);
    if (property.areaSqm) facts.push(`Superficie: ${property.areaSqm.toString()} m²`);
    if (property.bedrooms != null) facts.push(`Dormitorios: ${property.bedrooms}`);
    if (property.bathrooms != null) facts.push(`Baños: ${property.bathrooms}`);
    if (property.parkingSpaces != null) facts.push(`Parqueos: ${property.parkingSpaces}`);
    if (property.city) facts.push(`Ciudad: ${property.city}`);
    if (property.zone) facts.push(`Zona: ${property.zone}`);
    if (property.address) facts.push(`Dirección de referencia: ${property.address}`);
    if (property.description) facts.push(`Descripción previa (parafrasear, no copiar): ${property.description}`);
    if (opts.notes) facts.push(`Notas del agente: ${opts.notes}`);

    const user = [
      'Generá una descripción comercial para esta propiedad con los siguientes datos:',
      '',
      ...facts,
    ].join('\n');

    const result = await this.ai.generate(
      { system, user, maxTokens: Math.ceil(approxWords * 4), temperature: 0.7 },
      { provider: opts.provider, model: opts.model },
    );

    this.logger.log(
      `Descripción generada (provider=${result.provider} model=${result.model} ` +
        `in=${result.usage?.inputTokens ?? '?'} out=${result.usage?.outputTokens ?? '?'})`,
    );

    return {
      description: result.text,
      provider: result.provider,
      model: result.model,
      tone,
      usage: result.usage,
    };
  }
}
