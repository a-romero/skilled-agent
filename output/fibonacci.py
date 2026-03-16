def fibonacci(n):
    """Generate the first n Fibonacci numbers."""
    fib_numbers = []
    a, b = 0, 1
    for _ in range(n):
        fib_numbers.append(a)
        a, b = b, a + b
    return fib_numbers


def main():
    first_10 = fibonacci(10)
    print("The first 10 Fibonacci numbers are:")
    for i, num in enumerate(first_10, 1):
        print(f"  {i}: {num}")


if __name__ == "__main__":
    main()
