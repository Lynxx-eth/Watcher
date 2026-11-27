import os
import sys

# Make the `app` package importable without the full server stack.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
