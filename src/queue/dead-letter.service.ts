import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { JOB_NAMES, QUEUES } from './queue.constants';
import type { DeadLetterJobData } from './queue.types';

/**
 * Copies jobs that will never succeed into the 'dead-letter' queue (D26).
 * BullMQ emits 'failed' on EVERY attempt, so we only copy on the final one.
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(QUEUES.DEAD_LETTER) private readonly deadLetter: Queue<DeadLetterJobData>,
  ) {}

  async captureIfExhausted(queueName: string, job: Job | undefined, error: Error): Promise<void> {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = error instanceof UnrecoverableError || job.attemptsMade >= maxAttempts;

    if (!exhausted) {
      this.logger.warn(
        `${queueName} job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}), will retry: ${error.message}`,
      );
      return;
    }

    this.logger.error(
      `${queueName} job ${job.id} is dead after ${job.attemptsMade} attempt(s): ${error.message}`,
    );
    try {
      await this.deadLetter.add(
        JOB_NAMES.DEAD_LETTER,
        {
          sourceQueue: queueName,
          jobName: job.name,
          jobId: job.id,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          stack: error.stack,
          failedAt: new Date().toISOString(),
        },
        {
          jobId: `${queueName}-${job.id}`,
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } catch (dlqError) {
      this.logger.error(
        `Could not copy job ${job.id} to dead-letter: ${dlqError instanceof Error ? dlqError.message : String(dlqError)}`,
      );
    }
  }
}