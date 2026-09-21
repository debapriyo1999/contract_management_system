from itertools import count
import os

from datasets import load_dataset

from chatbot import connection, initialize_index, record_text, replace_source


def main() -> None:
    initialize_index()
    if os.getenv("FORCE_CUAD_REINDEX", "false").lower() != "true":
        with connection() as database:
            existing = database.execute("SELECT COUNT(*) FROM rag_chunks WHERE source LIKE 'cuad:%'").fetchone()[0]
        if existing:
            print(f"CUAD is already indexed with {existing} chunks. Set FORCE_CUAD_REINDEX=true to rebuild it.")
            return

    limit = int(os.getenv("CUAD_LIMIT", "0"))
    dataset = load_dataset("theatticusproject/cuad", streaming=True)
    split = dataset["train"] if hasattr(dataset, "keys") else dataset

    total_chunks = 0
    for index, record in zip(count(), split):
        text = record_text(record)
        chunks_indexed = replace_source(f"cuad:{index}", None, text)
        total_chunks += chunks_indexed
        print(f"Indexed CUAD document {index + 1}: {chunks_indexed} chunks")
        if limit and index + 1 >= limit:
            break

    print(f"Finished. Indexed {index + 1} CUAD documents and {total_chunks} chunks.")


if __name__ == "__main__":
    main()
