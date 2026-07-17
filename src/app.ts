import express from 'express';
import { clientRoutes } from './modules/clients/client.controller';
import { errorHandler } from './middleware/error-handler';
import { contractRoutes } from './modules/contract/contract.controller';

export const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use('/api/clients', clientRoutes);
app.use('/api/contracts', contractRoutes);
app.use(errorHandler);