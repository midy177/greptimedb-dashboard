// Build a pcap file (linktype=1, Ethernet) from SIP messages.
// Each message becomes a fake Ethernet/IPv4/UDP frame carrying the raw SIP payload.
// IP and UDP checksums are set to 0 — Wireshark accepts this by default.

const PCAP_MAGIC = 0xa1b2c3d4
const PCAP_VERSION_MAJOR = 2
const PCAP_VERSION_MINOR = 4
const SNAPLEN = 65535
const LINKTYPE_ETHERNET = 1

const ETH_HEADER_LEN = 14
const IP_HEADER_LEN = 20
const UDP_HEADER_LEN = 8
const FAKE_MAC = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]

function writeUint16BE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, false)
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function ipToBytes(ip: string): [number, number, number, number] {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return [127, 0, 0, 1]
  return [parts[0], parts[1], parts[2], parts[3]]
}

function buildPcapGlobalHeader(): ArrayBuffer {
  const buf = new ArrayBuffer(24)
  const v = new DataView(buf)
  writeUint32LE(v, 0, PCAP_MAGIC)
  v.setUint16(4, PCAP_VERSION_MAJOR, true)
  v.setUint16(6, PCAP_VERSION_MINOR, true)
  writeUint32LE(v, 8, 0) // thiszone
  writeUint32LE(v, 12, 0) // sigfigs
  writeUint32LE(v, 16, SNAPLEN)
  writeUint32LE(v, 20, LINKTYPE_ETHERNET)
  return buf
}

function buildFrame(
  srcIp: string,
  srcPort: number,
  dstIp: string,
  dstPort: number,
  tsSec: number,
  tsUsec: number,
  payload: Uint8Array
): ArrayBuffer {
  const udpLen = UDP_HEADER_LEN + payload.length
  const ipLen = IP_HEADER_LEN + udpLen
  const frameLen = ETH_HEADER_LEN + ipLen
  // pcap record header (16 bytes) + frame
  const buf = new ArrayBuffer(16 + frameLen)
  const v = new DataView(buf)

  // pcap record header
  writeUint32LE(v, 0, tsSec)
  writeUint32LE(v, 4, tsUsec)
  writeUint32LE(v, 8, frameLen)
  writeUint32LE(v, 12, frameLen)

  let off = 16

  // Ethernet header
  // dst mac
  FAKE_MAC.forEach((b, i) => v.setUint8(off + i, b))
  off += 6
  // src mac
  FAKE_MAC.forEach((b, i) => v.setUint8(off + i, b))
  off += 6
  // ethertype IPv4
  writeUint16BE(v, off, 0x0800)
  off += 2

  // IPv4 header
  v.setUint8(off, 0x45) // version=4, IHL=5
  off += 1
  v.setUint8(off, 0) // DSCP/ECN
  off += 1
  writeUint16BE(v, off, ipLen)
  off += 2
  writeUint16BE(v, off, 0) // identification
  off += 2
  writeUint16BE(v, off, 0) // flags/fragment offset
  off += 2
  v.setUint8(off, 64) // TTL
  off += 1
  v.setUint8(off, 17) // protocol UDP
  off += 1
  writeUint16BE(v, off, 0) // checksum = 0
  off += 2
  ipToBytes(srcIp).forEach((b) => {
    v.setUint8(off, b)
    off += 1
  })
  ipToBytes(dstIp).forEach((b) => {
    v.setUint8(off, b)
    off += 1
  })

  // UDP header
  writeUint16BE(v, off, srcPort)
  off += 2
  writeUint16BE(v, off, dstPort)
  off += 2
  writeUint16BE(v, off, udpLen)
  off += 2
  writeUint16BE(v, off, 0) // checksum = 0
  off += 2

  // SIP payload
  const dst = new Uint8Array(buf)
  dst.set(payload, off)

  return buf
}

export interface PcapMessage {
  timestamp: string // nanoseconds as string
  src_ip: string
  src_port: string
  dst_ip: string
  dst_port: string
  payload: string
}

export function buildPcap(messages: PcapMessage[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: ArrayBuffer[] = [buildPcapGlobalHeader()]

  messages.forEach((msg) => {
    const ns = BigInt(msg.timestamp)
    const tsSec = Number(ns / 1_000_000_000n)
    const tsUsec = Number((ns % 1_000_000_000n) / 1_000n)
    const srcPort = parseInt(msg.src_port, 10) || 5060
    const dstPort = parseInt(msg.dst_port, 10) || 5060
    const sipBytes = enc.encode(msg.payload || '')
    parts.push(buildFrame(msg.src_ip, srcPort, msg.dst_ip, dstPort, tsSec, tsUsec, sipBytes))
  })

  const total = parts.reduce((s, b) => s + b.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach((part) => {
    out.set(new Uint8Array(part), offset)
    offset += part.byteLength
  })
  return out
}
