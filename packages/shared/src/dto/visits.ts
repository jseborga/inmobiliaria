/**
 * Tipos del módulo de visitas. Compartidos entre web y API.
 * Nunca exponen el codeHash ni keys — el browser solo ve datos seguros.
 */

export type VisitStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface VisitListItem {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: VisitStatus;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  notes: string | null;
  phoneVerifiedAt: string | null;
  property: {
    id: string;
    slug: string;
    title: string;
  };
  assignedTo: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    role: string;
  } | null;
  lead: { id: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisitDetail extends VisitListItem {
  property: VisitListItem['property'] & {
    address: string | null;
    city: string | null;
    zone: string | null;
  };
  lead:
    | { id: string; firstName: string; lastName: string | null; email: string | null }
    | null;
  cancelReason: string | null;
}

export interface RequestVisitOtpResponse {
  expiresInSeconds: number;
  delivered: boolean;
  deliveryReason?: string;
}

export interface BookVisitResponse {
  id: string;
  status: VisitStatus;
  scheduledAt: string;
}

export interface WhatsappIntegrationView {
  tenantId: string;
  baseUrl: string | null;
  instance: string | null;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  testMode: boolean;
  enabled: boolean;
  cipherReady: boolean;
  updatedAt: string | null;
}

export interface SendWhatsappResult {
  sent: boolean;
  reason?: 'TEST_MODE' | 'NOT_CONFIGURED' | 'DISABLED';
}
