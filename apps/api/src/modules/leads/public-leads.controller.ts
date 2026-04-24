import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CreatePublicLeadDto } from './dto/create-public-lead.dto';
import { LeadsService } from './leads.service';

/**
 * Endpoint público de captura de leads.
 *
 *   POST /public/leads
 *
 * El tenant se resuelve por, en orden: middleware (subdominio/header),
 * body.tenantSlug, o body.propertyId. Se capturan metadatos de la request
 * (IP, UA, referrer) para auditoría y anti-spam.
 */
@Controller('public/leads')
export class PublicLeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreatePublicLeadDto) {
    return this.leads.createPublic(dto, req.tenant?.id, {
      sourceIp: this.extractIp(req),
      sourceUserAgent: req.header('user-agent') ?? undefined,
      sourceReferrer: req.header('referer') ?? undefined,
    });
  }

  private extractIp(req: Request): string | undefined {
    const fwd = req.header('x-forwarded-for');
    if (fwd) {
      const first = fwd.split(',')[0]?.trim();
      if (first) return first;
    }
    return req.ip ?? req.socket?.remoteAddress ?? undefined;
  }
}
