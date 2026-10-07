"""Password hashing via argon2 (pwdlib)."""
from pwdlib import PasswordHash

_password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored hash.

    Never raises: malformed/unknown hashes simply fail verification.
    """
    try:
        return _password_hasher.verify(plain_password, hashed_password)
    except Exception:
        return False
