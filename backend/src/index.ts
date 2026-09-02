import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend REST API server running on port ${config.port} (${config.nodeEnv})`);
});
