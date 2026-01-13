from typing import Dict
import json

from utils.utils import load_all_ids, get_ts_api

if __name__ == "__main__":

    organisations: Dict[str,int] = {}

    ids = load_all_ids()

    for id in ids:
        try:
            event_json = get_ts_api(id)

            ownerPOS = event_json["OwnerPOS"]

            full_owner_name = ownerPOS["Name"]
            prefix_number = ownerPOS["PrefixNumber"]
            prefix = ownerPOS["Prefix"]

            organisation = full_owner_name + " - " + prefix_number + " - " + prefix

            if organisation in organisations:
                organisations[organisation] += 1
            else:
                organisations[organisation] = 1
            
            # Save results to file at every step
            with open("organisations.txt", "w", encoding="utf-8") as f:
                f.write(json.dumps(organisations, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error processing id {id}: {e}")
            continue

    print(organisations)

