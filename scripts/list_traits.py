import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
PINECONE_INDEX = os.getenv('PINECONE_INDEX', 'mee-memory')

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX)

# 1. Get stats to see all namespaces
stats = index.describe_index_stats()
namespaces = stats['namespaces'].keys()
print(f'Namespaces: {list(namespaces)}')

all_traits = []

for ns in namespaces:
    print(f"Checking namespace: {ns}")
    # Query for traits in this namespace
    res = index.query(
        vector=[0.1]*1024,
        top_k=100,
        include_metadata=True,
        namespace=ns,
        filter={'role': 'trait'}
    )
    for m in res.matches:
        all_traits.append({
            'id': m.id,
            'text': m.metadata.get('text'),
            'created_at': m.metadata.get('created_at'),
            'namespace': ns
        })

# 2. Sort traits by ID (which starts with timestamp) or created_at
# The ID format in pinecone.py is {int(time.time())}-{role}
all_traits.sort(key=lambda x: x.get('id', '0'), reverse=True)

if all_traits:
    print(f'\nTop 5 latest traits found:')
    for i, trait in enumerate(all_traits[:5]):
        print(f'{i+1}. ID: {trait["id"]}')
        print(f'   Text: {trait["text"]}')
        print(f'   Namespace: {trait["namespace"]}')
        print(f'   Created At: {trait["created_at"]}')
        print('---')
else:
    print('\nNo traits found.')
