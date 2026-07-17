import { env } from './config/env';
import { app } from './app';

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});