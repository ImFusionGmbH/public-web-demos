import type { Annotation, AnnotationType, SharedImageSet } from '@imfusion/sdk';
import { useAnnotations, useDataLoader, useImFusion } from '@imfusion/sdk-react';
import { Button, Callout, IconButton, Row, Select, Stack, Typo } from '@imfusion/web-ui';
import { Eye, EyeClosed, Icon, Plus, Trash } from '@imfusion/web-ui/icons';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

const shapes = [
  { value: 'LineSegment', label: 'Line' },
  { value: 'Rectangle', label: 'Rectangle' },
  { value: 'Angle', label: 'Angle' },
  { value: 'Point', label: 'Point' },
] satisfies { value: AnnotationType; label: string }[];

type AnnotationEntry = { id: number; annotation: Annotation };

function AnnotationToolbar({ disabled, onAdd }: { disabled: boolean; onAdd: (type: AnnotationType) => void }) {
  const [type, setType] = useState<AnnotationType>('LineSegment');

  return (
    <Row align="center">
      <div style={{ flex: 1, minWidth: 0 }}>
        <Select.Root
          value={type}
          onValueChange={(value) => {
            if (value) setType(value);
          }}
          items={shapes}
          disabled={disabled}
          width="full"
          size="sm"
        >
          <Select.Trigger aria-label="Annotation shape">
            <Select.Value />
            <Select.Icon />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.List>
                  {shapes.map(({ value, label }) => (
                    <Select.Item key={value} value={value}>
                      <Select.ItemIndicator />
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </div>
      <Button
        size="sm"
        variant="outline"
        startIcon={<Icon glyph={Plus} aria-hidden />}
        disabled={disabled}
        onClick={() => onAdd(type)}
      >
        Add
      </Button>
    </Row>
  );
}

function AnnotationList({ entries, placing }: { entries: AnnotationEntry[]; placing: number | null }) {
  if (entries.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Annotations">
      {entries.map(({ id, annotation }) => (
        <AnnotationRow key={id} annotation={annotation} placing={id === placing} />
      ))}
    </ul>
  );
}

function AnnotationRow({ annotation, placing }: { annotation: Annotation; placing: boolean }) {
  const imf = useImFusion();
  const [visible, setVisible] = useState(annotation.state().visible !== false);
  const name = String(annotation.state().name);

  return (
    <li style={{ paddingBlock: 'var(--imf-ui-size-1)', borderTop: '1px solid var(--imf-ui-color-bg-minor)' }}>
      <Row align="center" gap="1">
        <Typo.Detail style={{ flex: 1 }} variant={visible ? 'main' : 'support'}>
          {name}
        </Typo.Detail>
        <IconButton
          size="sm"
          variant="outline"
          glyph={visible ? Eye : EyeClosed}
          label={`Show ${name}`}
          aria-pressed={visible}
          disabled={placing}
          onClick={() => {
            annotation.setState({ visible: !visible });
            setVisible(!visible);
            imf.render();
          }}
        />
        <IconButton
          size="sm"
          variant="outline"
          glyph={Trash}
          label={`Remove ${name}`}
          onClick={() => {
            imf.annotationModel.remove(annotation);
            imf.render();
          }}
        />
      </Row>
    </li>
  );
}

export default function AnnotationsDemo() {
  const imf = useImFusion();
  const { loadFileFromUrl, error } = useDataLoader();
  const [image, setImage] = useState<SharedImageSet>();
  const started = useRef(false);
  const annotations = useAnnotations(image, { trigger: false });
  const [owned, setOwned] = useState<AnnotationEntry[]>([]);
  const getOwned = useEffectEvent(() => owned);
  const nextId = useRef(1);
  const [placing, setPlacing] = useState<number | null>(null);

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
    function trackPlacement() {
      const model = imf.annotationModel;
      const off = model.onAnnotationEvent((annotation, event) => {
        if (!getOwned().some((entry) => entry.annotation.isAliasOf(annotation))) return;
        if (event === 'CreationFinished' || event === 'CreationAborted') setPlacing(null);
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
        setPlacing((id) => (id === entry.id ? null : id));
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

  function addAnnotation(type: AnnotationType) {
    if (!image) return;
    const annotation = imf.annotationModel.addInteractive(type, image);
    if (!annotation) return;
    const id = nextId.current++;
    setOwned((current) => [...current, { id, annotation }]);
    setPlacing(id);
    imf.canvas.focus({ preventScroll: true });
  }

  if (error)
    return (
      <Typo.P role="alert" style={{ padding: 'var(--imf-ui-size-3)' }}>
        Could not load the sample. Reload the page to try again.
      </Typo.P>
    );
  if (!image) return null;
  const entries = owned.filter(({ annotation }) => annotations.includes(annotation));

  return (
    <Stack
      gap="3"
      justify="between"
      style={{ padding: 'var(--imf-ui-size-3)', minHeight: '100%', boxSizing: 'border-box' }}
      aria-label="Annotation controls"
    >
      <Stack gap="3">
        <AnnotationToolbar disabled={placing !== null} onAdd={addAnnotation} />
        <AnnotationList entries={entries} placing={placing} />
        {placing !== null && (
          <Callout.Root variant="info" maxWidth="full">
            <Callout.Icon />
            <Callout.Description>Place the annotation in the views.</Callout.Description>
          </Callout.Root>
        )}
      </Stack>
      <Typo.Small variant="minor">Once created, left-click drag to move and right-click drag to modify.</Typo.Small>
    </Stack>
  );
}
