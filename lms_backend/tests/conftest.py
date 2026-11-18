import os

# The suites buy courses through the mock processor; production keeps it off.
os.environ.setdefault("ALLOW_MOCK_PAYMENTS", "true")
