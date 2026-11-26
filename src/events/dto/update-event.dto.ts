import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

/** Every field optional; if `categoryIds` is sent it replaces the whole set. */
export class UpdateEventDto extends PartialType(CreateEventDto) {}