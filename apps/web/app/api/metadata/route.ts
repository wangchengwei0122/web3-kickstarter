import { NextResponse, type NextRequest } from 'next/server';
import { pinata } from '@/utils/pinataConfig';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing metadata file' }, { status: 400 });
    }

    const { cid } = await pinata.upload.public.file(file);
    const gatewayUrl = await pinata.gateways.public.convert(cid);
    const uri = `ipfs://${cid}`;

    return NextResponse.json({ cid, uri, gatewayUrl }, { status: 200 });
  } catch (e) {
    console.error('[metadata-upload]', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
