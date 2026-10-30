# Topos MCP

Read what an MCP server declares as typed forms: its tools, access metadata and result envelopes. This world interprets supplied documents; it does not contact servers or invoke tools.

A declaration of a read-only hint is evidence about what the server says. It grants no permission and proves no absence of effects. The host owns transport, credentials, consent and execution.

## Inputs and views

The `server` reader interprets tool catalogues and authorization metadata. The `place` view projects the resulting offers and their forms. Each offer explicitly selects the protocol-owned `mcp-answer` view when a host has registered that view from the trusted capsule.

The response reader accepts a known offer and an MCP result envelope. It preserves the observed body digest, the presence of `isError`, text blocks, and counts of withheld content. Empty text is explicit. Structured content without an interpreted schema, non-text blocks and undeclared fields remain opaque.

An absent response file makes no claim. Unknown offers, conflicting readings, missing budgets and malformed envelopes disclose no result text. A host must keep identities of separate responses distinct.

## Budgets and authority

Byte and item budgets are explicit inputs. Existing limits remain unchanged: a response over its byte budget refuses; a narrower item limit changes the withheld count. Receiving a document or a package installs no authority.

The world uses the existing wire and answer forms. It adds no decision algebra, cell type, signer or network policy. Its runtime remains built against Topos 0.2.0; this release does not change that dependency.

## Use

Select `standing.bound` by its digest, verify the executable offer and its artifact closure, and register the declared views through the host's authority boundary. A matching artifact digest establishes integrity, not permission to connect to an address or call an offer.

The release consists of the exact capsule archive, its canonical standing and `release.json`. It is delivered as repository assets, not through npm. Version 0.1.2 changes the response interpretation; earlier releases and artifacts remain separate.

## Verification

The repository retains the prior protocol vectors and the result-envelope cases. `npm ci --ignore-scripts`, `npm run build`, and `node --test test/prior-vectors.test.ts test/response-fields.test.ts` run the producer's own checks. Bound verifies the producer obligations and the exact declared inputs; it is not the subject of these tests.

Producer admission, release approval and publication are separate acts. Test fixtures and a draft release are not evidence of public availability. Structured-content schemas and non-text media interpretation remain open capabilities.
