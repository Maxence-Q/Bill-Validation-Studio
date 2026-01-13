import json

if __name__ == "__main__":
    # Load organisations from file
    with open("organisations.txt", "r", encoding="utf-8") as f:
        organisations = json.load(f)
    
    # Filter organisations with 10 or more appearances
    organisations_filtered = {org: count for org, count in organisations.items() if count >= 100}
    
    # Save filtered results to file
    with open("organisations_filtered.txt", "w", encoding="utf-8") as f:
        f.write(json.dumps(organisations_filtered, indent=2, ensure_ascii=False))
    
    print(f"Total organisations: {len(organisations)}")
    print(f"Filtered organisations (10+): {len(organisations_filtered)}")
    print(organisations_filtered)
