declare module "apify-client" {
  export class ApifyClient {
    constructor(options: { token: string });
    actor(id: string): {
      call(input: unknown): Promise<{ defaultDatasetId: string }>;
    };
    dataset(id: string): {
      listItems(): Promise<{ items: unknown[] }>;
    };
  }
}
