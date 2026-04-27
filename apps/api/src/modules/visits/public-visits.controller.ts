import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import {
  BookVisitDto,
  RequestVisitOtpDto,
  VerifyVisitOtpDto,
} from './dto/book-visit.dto';
import { VisitsService } from './visits.service';

/**
 * Flow de booking público de visitas. Tres pasos:
 *   1. POST /public/visits/request-otp   { phone, tenantSlug, propertyId }
 *      → genera OTP, lo manda por WhatsApp (o lo loggea en testMode).
 *   2. POST /public/visits/verify-otp    { phone, code }
 *      → opcional, confirma el código antes de mostrar el form completo.
 *   3. POST /public/visits/book          { ...datos, otpCode }
 *      → consume el código y crea la visita en estado REQUESTED.
 */
@Controller('public/visits')
@Public()
export class PublicVisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestVisitOtpDto) {
    return this.visits.requestOtp(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyVisitOtpDto) {
    return this.visits.verifyOtp(dto);
  }

  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  async book(@Body() dto: BookVisitDto) {
    return this.visits.bookVisit(dto);
  }
}
