from qdrant_client import QdrantClient
from qdrant_client.http import models as qm
import os

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

COLLECTION = "similar_events_codewords_bgem3"
DENSE_NAME = "main_dense_vector"

def similar_by_id(eid: int, top_k: int = 4, display: bool = False) -> tuple[qm.QueryResponse, list[int]]:
    # exclure l’item lui-même (par sécurité)
    qfilter = qm.Filter(must_not=[qm.HasIdCondition(has_id=[eid])])

    res = client.query_points(
        collection_name=COLLECTION,
        query=eid,            # ← point de référence déjà indexé
        using=DENSE_NAME,          # "main_dense_vector"
        limit=top_k,
        with_payload=True,
        query_filter=qfilter,
    )
    
    points = res.points
    ids= [p.id for p in points]

    if display:
        print(f"[Query] id={eid}")
        for i, sp in enumerate(points, 1):
            payload = sp.payload or {}
            name = payload.get("name") or payload.get("NameFr")
            print(f"- {i}. id={sp.id}  score={sp.score:.3f}  name={name}")
    return res,ids





if __name__ == "__main__":
    _,_ = similar_by_id(3943, top_k=4, display=True)