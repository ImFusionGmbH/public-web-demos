import { useEffect, useRef, useState } from 'react';
import type { SharedImageSet } from '@imfusion/sdk';
import { useDataLoader, useImFusion } from '@imfusion/sdk-react';
import { ImageDisplayOptions } from '@imfusion/web-ui/integrations/image-display-options';

/**
 * Display-options controls.
 */
export default function DisplayOptionsPanel() {
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

  return <ImageDisplayOptions data={sis} variant="horizontal" />;
}
