import express from 'express';
import { clientRoutes } from './modules/clients/client.controller';
import { errorHandler } from './middleware/error-handler';

export const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.use('/api/clients', clientRoutes);
app.use(errorHandler);