import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    url = "http://localhost:3000/api/airtable/images?limit=3"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"HTTPError: {e.code}\n")
        sys.stderr.write(e.read().decode("utf-8", errors="replace") + "\n")
        return 1
    except Exception as e:
        sys.stderr.write(f"Request failed: {e}\n")
        return 1

    data = json.loads(body)
    items = data.get("items", [])
    print(f"count={data.get('count')} items_returned={len(items)}")
    for item in items[:3]:
        print(
            json.dumps(
                {
                    "id": item.get("id"),
                    "styleKey": item.get("styleKey"),
                    "name": item.get("name"),
                    "thumbUrl": item.get("thumbUrl"),
                    "imageUrl": item.get("imageUrl"),
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

