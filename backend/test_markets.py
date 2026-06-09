import requests

query = """
[out:json][timeout:25];
(
  node["shop"="seafood"](12.8,77.4,13.2,77.8);
  node["shop"="fish"](12.8,77.4,13.2,77.8);
);
out body;
"""

r = requests.post(
    "https://overpass-api.de/api/interpreter",
    data={"data": query}
)
print("Status:", r.status_code)
data = r.json()
elements = data.get("elements", [])
print(f"Found {len(elements)} markets near Bangalore")
for el in elements[:5]:
    name = el.get("tags", {}).get("name", "Unnamed Market")
    print(f"- {name} | lat={el.get('lat')} lng={el.get('lon')}")
