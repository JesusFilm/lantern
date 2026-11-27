import type { Request, Response } from 'express';
import type { OwnerPrincipal } from './owner-administration.js';

const protocolVersions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const listDepartmentsTool = {
  name: 'departments.list',
  description: 'List the IDs and names of active Lantern departments.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function handleOwnerMcp(req: Request, res: Response, owner: OwnerPrincipal) {
  const version = req.get('MCP-Protocol-Version');
  if (version !== undefined && !protocolVersions.includes(version)) {
    res.status(400).json({ error: 'Unsupported MCP protocol version.' });
    return;
  }
  const body: unknown = req.body;
  if (!object(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string' ||
      (body.id !== undefined && typeof body.id !== 'string' && !Number.isInteger(body.id))) {
    res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request.' } });
    return;
  }
  if (body.id === undefined) {
    res.status(202).end();
    return;
  }

  const reply = { jsonrpc: '2.0', id: body.id };
  switch (body.method) {
    case 'initialize': {
      const requested = object(body.params) && body.params.protocolVersion;
      const protocolVersion = typeof requested === 'string' && protocolVersions.includes(requested) ? requested : protocolVersions[0];
      res.json({ ...reply, result: {
        protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'lantern', version: '0.1.0' },
      } });
      return;
    }
    case 'ping':
      res.json({ ...reply, result: {} });
      return;
    case 'tools/list':
      res.json({ ...reply, result: { tools: [listDepartmentsTool] } });
      return;
    case 'tools/call': {
      const params = body.params;
      if (!object(params) || params.name !== listDepartmentsTool.name ||
          (params.arguments !== undefined && (!object(params.arguments) || Object.keys(params.arguments).length > 0))) {
        res.json({ ...reply, error: { code: -32602, message: 'Use departments.list without arguments.' } });
        return;
      }
      const result = await owner.listDepartments();
      res.json({ ...reply, result: {
        content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result,
      } });
      return;
    }
    default:
      res.json({ ...reply, error: { code: -32601, message: 'Method not found.' } });
  }
}
