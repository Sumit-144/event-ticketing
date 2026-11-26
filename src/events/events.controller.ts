import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  applyDecorators,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTierDto, UpdateTicketTierDto } from './dto/create-ticket-tier.dto';
import { FilterEventsDto } from './dto/filter-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventListPage, EventsService } from './events.service';
import { EventDetail, TicketTierView } from './events.types';

/** ORGANIZER or ADMIN only (ownership is checked in the service) + the Swagger lock. */
const ManagerOnly = () =>
  applyDecorators(ApiBearerAuth(), Roles(Role.ORGANIZER, Role.ADMIN));

/**
 * Route order matters: `mine` routes are declared BEFORE `:id`, otherwise Express would
 * match "mine" as an id. `@Roles` is per method on purpose (see class note in the docs):
 * a class-level @Roles would 403 the public routes, which run without a user.
 */
@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ─── Owner views (static paths first) ──────────────────────────────────────

  @Get('mine')
  @ManagerOnly()
  @ApiOperation({ summary: 'List my events, drafts included' })
  @ResponseMessage('Your events fetched successfully')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: FilterEventsDto,
  ): Promise<EventListPage> {
    return this.eventsService.listMine(user, filters);
  }

  @Get('mine/:id')
  @ManagerOnly()
  @ApiOperation({ summary: 'View one of my events in any status (owner or admin)' })
  @ResponseMessage('Event fetched successfully')
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<EventDetail> {
    return this.eventsService.getMine(user, id);
  }

  // ─── Public reads ──────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'List published events (cached, filters + pagination)' })
  @ResponseMessage('Events fetched successfully')
  list(@Query() filters: FilterEventsDto): Promise<EventListPage> {
    return this.eventsService.listPublic(filters);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a published event with its ticket tiers' })
  @ResponseMessage('Event fetched successfully')
  getOne(@Param('id', ParseUuidPipe) id: string): Promise<EventDetail> {
    return this.eventsService.getPublic(id);
  }

  @Get(':id/tiers')
  @Public()
  @ApiOperation({ summary: 'List ticket tiers of a published event' })
  @ResponseMessage('Ticket tiers fetched successfully')
  listTiers(@Param('id', ParseUuidPipe) id: string): Promise<TicketTierView[]> {
    return this.eventsService.listTiers(id);
  }

  // ─── Event writes ──────────────────────────────────────────────────────────

  @Post()
  @ManagerOnly()
  @ApiOperation({ summary: 'Create an event (starts as DRAFT)' })
  @ResponseMessage('Event created successfully')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ): Promise<EventDetail> {
    return this.eventsService.create(user, dto);
  }

  @Patch(':id')
  @ManagerOnly()
  @ApiOperation({ summary: 'Update an event (DRAFT or PUBLISHED only)' })
  @ResponseMessage('Event updated successfully')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventDetail> {
    return this.eventsService.update(user, id, dto);
  }

  @Delete(':id')
  @ManagerOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an event (blocked while it has active bookings)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.eventsService.remove(user, id);
  }

  @Post(':id/publish')
  @ManagerOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a draft event' })
  @ResponseMessage('Event published successfully')
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<EventDetail> {
    return this.eventsService.publish(user, id);
  }

  @Post(':id/cancel')
  @ManagerOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a published event' })
  @ResponseMessage('Event cancelled successfully')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<EventDetail> {
    return this.eventsService.cancel(user, id);
  }

  // ─── Ticket tier writes ────────────────────────────────────────────────────

  @Post(':id/tiers')
  @ManagerOnly()
  @ApiOperation({ summary: 'Add a ticket tier to an event' })
  @ResponseMessage('Ticket tier created successfully')
  createTier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CreateTicketTierDto,
  ): Promise<TicketTierView> {
    return this.eventsService.createTier(user, id, dto);
  }

  @Patch(':id/tiers/:tierId')
  @ManagerOnly()
  @ApiOperation({ summary: 'Update a ticket tier (capacity cannot drop below booked seats)' })
  @ResponseMessage('Ticket tier updated successfully')
  updateTier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUuidPipe) id: string,
    @Param('tierId', ParseUuidPipe) tierId: string,
    @Body() dto: UpdateTicketTierDto,
  ): Promise<TicketTierView> {
    return this.eventsService.updateTier(user, id, tierId, dto);
  }
}