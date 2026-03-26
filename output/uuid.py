import uuid


def main():
    """Generate and print a random UUID."""
    random_uuid = uuid.uuid4()
    print(f"Generated UUID: {random_uuid}")


if __name__ == "__main__":
    main()
