import amqp, { type ConfirmChannel } from 'amqplib';
import { env } from '../../config/env';

export async function createRabbitMqChannel(): Promise<ConfirmChannel> {
  const connection = await amqp.connect(env.rabbitMqUrl);
  return connection.createConfirmChannel();
}
