const USERNAME_REGEX = /^[a-zA-Z0-9-]{1,39}$/;

export function validateUsername(username) {
  if (typeof username !== "string") {
    return false;
  }

  return USERNAME_REGEX.test(username);
}
