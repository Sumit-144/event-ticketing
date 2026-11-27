import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BookingNotificationView } from './queue.types';

/** Read-only lookups for processors. Booking reads do not filter deletedAt (D20). */
@Injectable()
export class QueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBookingForNotification(bookingId: string): Promise<BookingNotificationView | null> {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        quantity: true,
        totalAmount: true,
        ticketCode: true,
        user: { select: { name: true, email: true } },
        ticketTier: { select: { name: true } },
        event: {
          select: {
            title: true,
            venue: true,
            city: true,
            startDate: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!b) return null;
    return {
      id: b.id,
      status: b.status,
      quantity: b.quantity,
      totalAmount: b.totalAmount.toString(),
      ticketCode: b.ticketCode,
      userName: b.user.name,
      userEmail: b.user.email,
      tierName: b.ticketTier.name,
      eventTitle: b.event.title,
      eventVenue: b.event.venue,
      eventCity: b.event.city,
      eventStartDate: b.event.startDate,
      eventStatus: b.event.status,
      eventDeleted: b.event.deletedAt !== null,
    };
  }
}