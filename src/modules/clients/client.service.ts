import type { Client } from '@prisma/client';
import type { ClientRepository } from './client.repository';
import type { CreateClientInput, UpdateClientInput } from './client.validate';
import { AppError } from '../../erros/app-error';

export class ClientService {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

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

  async getById(id: string): Promise<Client> {
    return this.requireClient(id);
  }

  async update(id: string, input: UpdateClientInput): Promise<Client> {
    const client = await this.requireClient(id);
    const documentOwner = await this.clientRepository.findByDocument(input.document);

    if (documentOwner && documentOwner.id !== client.id) {
      throw new AppError('A client with this document already exists', 409);
    }

    return this.clientRepository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    await this.requireClient(id);
    if ((await this.clientRepository.countNonDeletedContracts(id)) > 0) {
      throw new AppError('Client has active contracts', 409);
    }
    await this.clientRepository.softDelete(id, this.now());
  }

  private async requireClient(id: string): Promise<Client> {
    const client = await this.clientRepository.findById(id);
    if (!client) throw new AppError('Client not found', 404);
    return client;
  }
}
