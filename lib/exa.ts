import Exa from 'exa-js';

let client: Exa | null = null;

export function getExaClient(): Exa {
  if (!client) {
    if (!process.env.EXA_API_KEY) throw new Error('EXA_API_KEY not configured');
    client = new Exa(process.env.EXA_API_KEY);
  }
  return client;
}
