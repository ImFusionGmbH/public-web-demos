import type { Annotation, SharedImageSet } from '@imfusion/sdk';
import { useAnnotations, useDataLoader, useImFusion } from '@imfusion/sdk-react';
import { Button, Callout, Collapsible, IconButton, Input, Row, Stack, Typo } from '@imfusion/web-ui';
import { Icon, Plus, Trash } from '@imfusion/web-ui/icons';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

const colors = [
  [1, 0.72, 0.22, 1],
  [0.2, 0.75, 1, 1],
  [0.8, 0.5, 1, 1],
  [0.4, 0.9, 0.5, 1],
];

type Draft = { id: number; phase: 'placing' } | { id: number; phase: 'writing'; text: string };

export default function AnnotationCommentsDemo() {
  const imf = useImFusion();
  const { loadFileFromUrl, error } = useDataLoader();
  const [image, setImage] = useState<SharedImageSet>();
  const started = useRef(false);
  const annotations = useAnnotations(image, { trigger: true });
  const [owned, setOwned] = useState<{ id: number; annotation: Annotation }[]>([]);
  const getOwned = useEffectEvent(() => owned);
  const nextId = useRef(1);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(
    function loadSampleVolume() {
      if (started.current) return;
      started.current = true;

      loadFileFromUrl(new URL('../example_data/CT/img.imf', import.meta.url).href)
        .then((data) => {
          imf.showAll(data);
          setImage(imf.bindings.getImages(data)[0]);
        })
        .catch(() => {});
    },
    [imf, loadFileFromUrl],
  );

  useEffect(
    function connectComments() {
      const model = imf.annotationModel;
      const off = model.onAnnotationEvent((annotation, event) => {
        const entry = getOwned().find((entry) => entry.annotation.isAliasOf(annotation));
        if (!entry) return;
        if (event === 'CreationFinished') {
          setDraft({ id: entry.id, phase: 'writing', text: '' });
          setSelected(entry.id);
        }
        if (event === 'CreationAborted')
          queueMicrotask(() => {
            if (model.annotations().includes(annotation)) model.remove(annotation);
            imf.render();
          });
      });
      const offRemoved = model.onAnnotationAboutToBeRemoved((annotation) => {
        const entry = getOwned().find((entry) => entry.annotation.isAliasOf(annotation));
        if (!entry) return;
        setOwned((current) => current.filter((item) => item.id !== entry.id));
        setDraft((current) => (current?.id === entry.id ? null : current));
        setSelected((id) => (id === entry.id ? null : id));
        setComments((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
      });
      return () => {
        off();
        offRemoved();
        const remaining = model.annotations();
        getOwned().forEach(({ annotation }) => {
          if (remaining.includes(annotation)) model.remove(annotation);
        });
      };
    },
    [imf],
  );

  function addComment() {
    if (!image) return;
    const annotation = imf.annotationModel.addInteractive('Point', image, image.focus());
    if (!annotation) return;
    const id = nextId.current++;
    annotation.onTriggerActivated(() => setSelected(id));
    setOwned((current) => [...current, { id, annotation }]);
    annotation.setState({ name: `Comment ${id}`, color: colors[(id - 1) % colors.length], labelVisible: false });
    annotation.setTrigger('SpeechBubble');
    setDraft({ id, phase: 'placing' });
    setSelected(null);
    imf.canvas.focus({ preventScroll: true });
  }

  function goTo(annotation: Annotation) {
    if (!image) return;
    const frameIndex = imf.annotationModel.frameIndex(annotation);
    if (frameIndex !== undefined) image.setFocus(frameIndex);
    const point = annotation.navigationPoint();
    if (point) imf.display.viewGroup().centerOnLocation(point);
    imf.render();
  }

  if (error)
    return (
      <Typo.P role="alert" style={{ padding: 'var(--imf-ui-size-3)' }}>
        Could not load the sample. Reload the page to try again.
      </Typo.P>
    );
  if (!image) return null;
  const entries = owned.filter(
    ({ id, annotation }) => annotations.includes(annotation) && !(draft?.phase === 'placing' && draft.id === id),
  );

  return (
    <Stack
      gap="3"
      justify="between"
      style={{ padding: 'var(--imf-ui-size-3)', minHeight: '100%', boxSizing: 'border-box' }}
      aria-label="Comment controls"
    >
      <Stack gap="3">
        <Row justify="center">
          <Button
            size="sm"
            variant="outline"
            startIcon={<Icon glyph={Plus} aria-hidden />}
            disabled={draft !== null}
            onClick={addComment}
          >
            Add comment
          </Button>
        </Row>

        {entries.length > 0 && (
          <Stack gap="2" aria-label="Comments">
            {entries.map(({ id, annotation }) => (
              <Collapsible.Root
                key={id}
                density="compact"
                variant="solid"
                open={selected === id}
                onOpenChange={(open) => setSelected(open ? id : null)}
              >
                <Collapsible.Trigger disabled={draft?.phase === 'placing'}>Comment {id}</Collapsible.Trigger>
                <Collapsible.Panel style={{ backgroundColor: 'var(--imf-ui-color-bg-minor)' }}>
                  <Stack gap="2" style={{ padding: 'var(--imf-ui-size-2)' }}>
                    {draft?.id === id && draft.phase === 'writing' ? (
                      <form
                        id={`comment-${id}-form`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const text = draft.text.trim();
                          if (!text) return;
                          setComments((current) => ({ ...current, [id]: text }));
                          setDraft(null);
                        }}
                      >
                        <Input
                          autoFocus
                          aria-label={`Comment ${id} text`}
                          placeholder="Write a comment…"
                          value={draft.text}
                          onValueChange={(text) => setDraft({ id, phase: 'writing', text })}
                        />
                      </form>
                    ) : (
                      <Typo.Detail style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {comments[id]}
                      </Typo.Detail>
                    )}
                    <Row justify="end" gap="1">
                      {draft?.id === id && draft.phase === 'writing' && (
                        <Button
                          size="sm"
                          type="submit"
                          form={`comment-${id}-form`}
                          style={{ marginInlineEnd: 'auto' }}
                          disabled={!draft.text.trim()}
                          shortcut="Enter"
                        >
                          Save
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        style={{ paddingInline: 'var(--imf-ui-size-2)' }}
                        aria-label={`Go to comment ${id}`}
                        disabled={draft?.phase === 'placing'}
                        onClick={() => goTo(annotation)}
                      >
                        Go to
                      </Button>
                      <IconButton
                        size="sm"
                        variant="outline"
                        glyph={Trash}
                        label={`Remove comment ${id}`}
                        onClick={() => {
                          imf.annotationModel.remove(annotation);
                          imf.render();
                        }}
                      />
                    </Row>
                  </Stack>
                </Collapsible.Panel>
              </Collapsible.Root>
            ))}
          </Stack>
        )}
        {draft?.phase === 'placing' && (
          <Callout.Root variant="info" maxWidth="full">
            <Callout.Icon />
            <Callout.Description>Place the comment in the views.</Callout.Description>
          </Callout.Root>
        )}
      </Stack>
      <Typo.Small variant="minor">Once you have multiple comments, click a trigger in the views to open its comment and collapse others.</Typo.Small>
    </Stack>
  );
}
