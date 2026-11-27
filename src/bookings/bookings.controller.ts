import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { BookingListPage, BookingsService } from './bookings.service';
import { BookingView } from './bookings.types';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';

/**
 * Thin HTTP layer: all rules (seat locking, ownership, cancel windows) live in the service.
 * `me` is declared BEFORE `:id`, otherwise "me" would be matched as an id.
 */
@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.ATTENDEE)
  @ApiOperation({ summary: 'Book seats in a ticket tier (attendees only, confirmed immediately)' })
  @ResponseMessage('Booking confirmed successfully')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingView> {
    return this.bookingsService.create(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my bookings, cancelled ones included (optional status filter)' })
  @ResponseMessage('Your bookings fetched successfully')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: ListBookingsDto,
  ): Promise<BookingListPage> {
    return this.bookingsService.listMine(user, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one booking (owner or admin; anyone else gets 404)' })
  @ResponseMessage('Booking fetched successfully')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<BookingView> {
    return this.bookingsService.getOne(user, id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking (owner until the event starts, admin any time)' })
  @ResponseMessage('Booking cancelled successfully')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<BookingView> {
    return this.bookingsService.cancel(user, id);
  }
}