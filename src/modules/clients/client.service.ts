import type { Client } from '@prisma/client';
import type { ClientRepository } from './client.repository';
import type { CreateClientInput } from './client.validate';
import { AppError } from '../../erros/app-error';

export class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}

  async create(input: CreateClientInput): Promise<Client> {
    const existingClient = await this.clientRepository.findByDocument(
      input.document,
    );

    if (existingClient) {
      throw new AppError('A client with this document already exists', 409);
    }

    return this.clientRepository.create(input);
  }

  async list(): Promise<Client[]> {
    return this.clientRepository.findMany({ orderBy: { name: 'asc' } });
  }
}
