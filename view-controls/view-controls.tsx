import { SharedImageSet } from '@imfusion/sdk';
import { useDataLoader, useImFusion, useVisibleData } from '@imfusion/sdk-react';
import { Icon, IconButton, Popover, Row, Separator, Toggle } from '@imfusion/web-ui';
import { Brightness, IconComponent, ToolCrosshairChecked, ToolLayout } from '@imfusion/web-ui/icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ImageDisplayOptions } from '@imfusion/web-ui/integrations/image-display-options';
import { ViewTools } from '@imfusion/web-ui/integrations/view-tools';
import { LayoutMode } from '@imfusion/web-ui/integrations/layout-mode';

function ViewControlPopover({
  iconGlyph,
  label,
  children,
}: {
  iconGlyph: IconComponent;
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger nativeButton={false}>
        <IconButton glyph={iconGlyph} label={label} variant="ghost" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start">
          <Popover.Popup style={{ maxWidth: 'unset' }} variant="ghost">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ViewControlsToolbar() {
  const imf = useImFusion();

  const data = useVisibleData();
  const images = imf.bindings.getImages(data);
  let selectedImage = undefined;
  for (const image of images) {
    if (image.modality() !== 'LABEL') {
      selectedImage = image;
      break;
    }
  }

  const [sliceIndicatorVisible, setSliceIndicatorVisible] = useState(imf.display.sliceIndicator().visible);

  useEffect(
    function syncSliceIndicator() {
      imf.display.sliceIndicator().visible = sliceIndicatorVisible;
      imf.display.render();
    },
    [imf.display, sliceIndicatorVisible],
  );

  return (
    <Row align="center">
      <ViewTools></ViewTools>
      <Separator orientation="vertical"></Separator>
      <Toggle onPressedChange={(pressed) => setSliceIndicatorVisible(pressed)} pressed={sliceIndicatorVisible}>
        <Icon glyph={ToolCrosshairChecked}></Icon>
      </Toggle>
      <Separator orientation="vertical"></Separator>
      <ViewControlPopover iconGlyph={ToolLayout} label="Layout">
        <LayoutMode></LayoutMode>
      </ViewControlPopover>
      <ViewControlPopover iconGlyph={Brightness} label="DisplayOptions">
        {selectedImage && <ImageDisplayOptions data={selectedImage} />}
      </ViewControlPopover>
    </Row>
  );
}

export default function ViewControlsDemo() {
  const imf = useImFusion();
  const { loadFileFromUrl, error } = useDataLoader();
  const [sis, setSis] = useState<SharedImageSet | null>(null);

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    loadFileFromUrl(new URL('../example_data/CT/img.imf', import.meta.url).href)
      .then((data) => {
        imf.showAll(data);
        setSis(imf.dataModel.getImage());
      })
      .catch(() => {});
  }, [imf, loadFileFromUrl]);

  if (error) return <p style={{ fontSize: 14 }}>Failed to load the sample volume: {error.message}</p>;
  if (!sis) return <p style={{ fontSize: 14 }}>Loading data…</p>;

  return <ViewControlsToolbar></ViewControlsToolbar>;
}
