import sys, json
lines = [l.strip() for l in sys.stdin if l.strip()]
events = []
for l in lines:
    try:
        events.append(json.loads(l))
    except Exception:
        pass
print(f'Total events found: {len(events)}')
for e in events:
    tags = e.get('tags', [])
    type_tag = next(
        (t[1] for t in tags
         if t[0] == 't' and t[1].startswith('scrutiny_')
         and t[1] not in ('scrutiny_fabric', 'scrutiny_v032')),
        '?'
    )
    print(f'  [{type_tag:<24}] {e["id"][:16]}...  {e["content"][:55]}')
