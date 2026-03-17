export const CUSTOMER_AGENT_PREFIX = 'customer-agent';
export const VENDOR_AGENT_PREFIX = 'vendor-agent';
export const SYSTEM_AGENT_ID = 'system-agent';

export function isAgentSender(senderId: string): boolean {
    return senderId.startsWith(CUSTOMER_AGENT_PREFIX) ||
           senderId.startsWith(VENDOR_AGENT_PREFIX) ||
           senderId === SYSTEM_AGENT_ID;
}

export function getAgentLabel(senderId: string): string {
    if (senderId === SYSTEM_AGENT_ID) return 'System Agent';
    if (senderId.startsWith(CUSTOMER_AGENT_PREFIX)) return 'Your Agent';
    if (senderId.startsWith(VENDOR_AGENT_PREFIX)) return 'Vendor Agent';
    return 'User';
}
