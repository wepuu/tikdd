import ipaddr from "ipaddr.js";

type ParsedAddress = ReturnType<typeof ipaddr.process>;
type ParsedCidr = ReturnType<typeof ipaddr.parseCIDR>;

export class InvalidForwardingChainError extends Error {
  constructor() {
    super("The forwarding chain is invalid or ambiguous.");
    this.name = "InvalidForwardingChainError";
  }
}

function parseAddress(raw: string | undefined): ParsedAddress {
  if (!raw || raw.includes("%") || !ipaddr.isValid(raw)) {
    throw new InvalidForwardingChainError();
  }
  return ipaddr.process(raw);
}

function normalizeAddress(address: ParsedAddress): string {
  return address.toNormalizedString();
}

function matches(address: ParsedAddress, cidr: ParsedCidr): boolean {
  return address.kind() === cidr[0].kind() && address.match(cidr);
}

export class TrustedProxyResolver {
  private readonly trustedCidrs: readonly ParsedCidr[];

  constructor(cidrs: readonly string[]) {
    try {
      this.trustedCidrs = cidrs.map((cidr) => ipaddr.parseCIDR(cidr));
    } catch {
      throw new Error("TRUSTED_PROXY_CIDRS contains an invalid network.");
    }
  }

  resolve(input: {
    socketAddress: string | undefined;
    forwardedFor: string | readonly string[] | undefined;
  }): string {
    const socket = parseAddress(input.socketAddress);
    if (this.trustedCidrs.length === 0 || !this.isTrusted(socket)) {
      return normalizeAddress(socket);
    }
    if (input.forwardedFor === undefined) {
      return normalizeAddress(socket);
    }
    if (typeof input.forwardedFor !== "string" || input.forwardedFor.length > 4_096) {
      throw new InvalidForwardingChainError();
    }
    const rawChain = input.forwardedFor.split(",").map((value) => value.trim());
    if (rawChain.length === 0 || rawChain.length > 16 || rawChain.some((value) => !value)) {
      throw new InvalidForwardingChainError();
    }
    const forwarded = rawChain.map(parseAddress);
    const nearestFirst = [socket, ...forwarded.reverse()];
    const firstUntrusted = nearestFirst.findIndex((address) => !this.isTrusted(address));
    if (firstUntrusted >= 0 && firstUntrusted !== nearestFirst.length - 1) {
      throw new InvalidForwardingChainError();
    }
    return normalizeAddress(nearestFirst.at(-1) as ParsedAddress);
  }

  private isTrusted(address: ParsedAddress): boolean {
    return this.trustedCidrs.some((cidr) => matches(address, cidr));
  }
}
