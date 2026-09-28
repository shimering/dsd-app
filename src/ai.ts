import { supabase } from './cloud';
import { validateProposal, type Proposal } from './assistProtocol';
import { type Workspace, type Photo } from './domain';
export async function encodePhoto(
  image: HTMLImageElement,
): Promise<{ mimeType: 'image/jpeg'; data: string }> {
  const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    ),
    canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    mimeType: 'image/jpeg',
    data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1],
  };
}
export async function requestAssistance(
  workspace: Workspace,
  photo: Photo,
  image: HTMLImageElement,
  operation: Proposal['operation'],
  model: string,
  blueprint?: { mimeType: 'image/jpeg'; data: string },
): Promise<Proposal> {
  if (!supabase) throw new Error('Sign in to use AI assistance.');
  if (!workspace.consent)
    throw new Error('Record patient consent before sending this photo.');
  const source = {
    workspaceId: workspace.id,
    photoId: photo.id,
    sourceRevision: photo.revision,
  };
  const { data, error } = await supabase.functions.invoke('smile-assist', {
    body: {
      ...source,
      operation,
      model,
      image: await encodePhoto(image),
      ...(blueprint ? { blueprint } : {}),
    },
  });
  if (error) {
    let message =
      'AI assistance is unavailable. Continue with the manual tools.';
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      /* Generic errors stay readable and do not expose provider payloads. */
    }
    throw new Error(message);
  }
  const proposal = validateProposal(data, source);
  if (proposal.operation !== operation)
    throw new Error(
      'The AI returned a different proposal type. It was rejected.',
    );
  return proposal;
}
