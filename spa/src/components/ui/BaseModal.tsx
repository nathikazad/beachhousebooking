import { Modal, ButtonToolbar, Button } from 'rsuite';
import RemindIcon from '@rsuite/icons/legacy/Remind';
import { useState, useEffect } from 'react';

interface BaseModalProps {
  openModal?: boolean;
  loading?: boolean;
  message?: string;
  okText?: string;
  noText?: string;
  onClose: () => void;
  onOk?: () => void;
  onNo?: () => void;
}
const BaseModalComponent: React.FC<BaseModalProps> = ({
  message,
  loading,
  openModal,
  onClose,
  onOk,
  onNo,
  okText,
  noText
}) => {
  useEffect(() => {
    setOpen(!!openModal);
  }, [openModal]);
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <>
      <Modal
        backdrop="static"
        role="alertdialog"
        open={open}
        onClose={handleClose}
        size="xs"
      >
        <Modal.Body>
          <RemindIcon style={{ color: "#ffb300", fontSize: 24 }} />
          <span className="whitespace-pre-line">{message}</span>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onOk ? onOk : handleClose} appearance="primary" loading={loading} >
            {okText ? okText : 'Ok'}
          </Button>
          {onNo && <Button onClick={onNo} appearance="default" loading={loading}>
            {noText ? noText : 'No'}
          </Button>}
          <Button onClick={handleClose} appearance="subtle" loading={loading}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default BaseModalComponent
