import { Cluster, EnrichedCluster } from "../domain/model.js";

export interface AIProvider {
  enrich(clusters: Cluster[]): Promise<EnrichedCluster[]>;
}
