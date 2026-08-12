import { validateNewPassword } from "./auth";
import { readHiddenSecret } from "./hidden-secret";

type SecretReader = (prompt: string) => Promise<string>;
type MessageWriter = (message: string) => void;

function validationMessage(username: string, password: string): string {
  if (password.length < 8) return "Password must contain at least 8 characters.";
  if (password.length > 128) return "Password must contain no more than 128 characters.";
  if (!password.trim()) return "Password cannot be blank or whitespace only.";
  if (password.toLowerCase() === username.toLowerCase()) return "Password cannot be the same as the username.";
  return "Password is too common. Choose a less predictable password.";
}

export async function requestValidPassword(
  username: string,
  readSecret: SecretReader = readHiddenSecret,
  write: MessageWriter = (message) => process.stdout.write(message)
): Promise<string> {
  write("Password requirements: 8-128 characters; not blank, the username, or a common weak password.\n");

  for (;;) {
    const first = await readSecret("New administrator password: ");
    const second = await readSecret("Confirm administrator password: ");
    if (first !== second) {
      write("Passwords do not match. Please try again.\n");
      continue;
    }
    try {
      return validateNewPassword(username, first);
    } catch {
      write(`${validationMessage(username, first)} Please try again.\n`);
    }
  }
}
