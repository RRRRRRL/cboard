/**
 * Device Detection Utilities for External Switches and Eye Tracking
 * Sprint 6: Hardware Integration
 */

// Switch Device Detection
export class SwitchDeviceDetector {
  static async detectUSBDevices() {
    try {
      if (!navigator.usb) {
        console.warn('WebUSB API not supported');
        return [];
      }
      
      const devices = await navigator.usb.getDevices();
      return devices.map(device => ({
        type: 'wired',
        connection_type: 'usb',
        device_id: device.serialNumber || device.productId.toString(),
        device_name: device.productName || 'USB Switch',
        device_info: {
          vendorId: device.vendorId,
          productId: device.productId
        }
      }));
    } catch (error) {
      console.error('USB device detection error:', error);
      return [];
    }
  }
  
  static async requestUSBDevice() {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB API not supported');
      }
      
      const device = await navigator.usb.requestDevice({
        filters: [{ classCode: 3 }] // HID devices
      });
      
      return {
        type: 'wired',
        connection_type: 'usb',
        device_id: device.serialNumber || device.productId.toString(),
        device_name: device.productName || 'USB Switch',
        device_info: {
          vendorId: device.vendorId,
          productId: device.productId
        }
      };
    } catch (error) {
      console.error('USB device request error:', error);
      throw error;
    }
  }
  
  static async detectBluetoothDevices() {
    try {
      if (!navigator.bluetooth) {
        console.warn('Web Bluetooth API not supported');
        return null;
      }
      
      // Note: Bluetooth device scanning requires user interaction
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['00001812-0000-1000-8000-00805f9b34fb'] } // HID service
        ]
      });
      
      return {
        type: 'bluetooth',
        connection_type: 'bluetooth',
        device_id: device.id,
        device_name: device.name || 'Bluetooth Switch',
        device_info: {
          id: device.id,
          name: device.name
        }
      };
    } catch (error) {
      console.error('Bluetooth device detection error:', error);
      return null;
    }
  }
  
  static setupSwitchListener(device, onPress, onLongPress) {
    let pressStartTime = null;
    const longPressThreshold = 1500; // 1.5 seconds
    
    if (device.connection_type === 'usb') {
      // USB HID event listener
      if (device.addEventListener) {
        device.addEventListener('inputreport', (event) => {
          const data = new Uint8Array(event.data.buffer);
          if (data[0] === 1) { // Button press
            if (!pressStartTime) {
              pressStartTime = Date.now();
            }
          } else { // Button release
            if (pressStartTime) {
              const pressDuration = Date.now() - pressStartTime;
              pressStartTime = null;
              
              if (pressDuration >= longPressThreshold) {
                onLongPress(pressDuration);
              } else {
                onPress();
              }
            }
          }
        });
      }
    } else if (device.connection_type === 'bluetooth') {
      // Bluetooth event listener
      // Implementation depends on specific Bluetooth device protocol
      console.log('Bluetooth switch listener setup needed');
    }
  }
}

// Eye Tracking Device Detection
export class EyeTrackingDetector {
  static async detectTobiiDevice() {
    try {
      // Tobii SDK integration
      // This requires Tobii SDK to be loaded
      if (typeof window.Tobii === 'undefined') {
        console.warn('Tobii SDK not loaded');
        return null;
      }
      
      const tracker = await window.Tobii.createTracker();
      return {
        device_type: 'tobii',
        device_name: 'Tobii Eye Tracker',
        device_id: tracker.deviceId || 'tobii_default',
        sdk_version: window.Tobii.version || '1.0.0',
        device_info: {
          model: tracker.model,
          firmware: tracker.firmware
        }
      };
    } catch (error) {
      console.error('Tobii device detection error:', error);
      return null;
    }
  }
  
  static setupGazeTracking(tracker, onGaze, onDwell) {
    const dwellThreshold = 1000; // 1 second
    let dwellStartTime = null;
    let currentCard = null;
    
    if (tracker && tracker.on) {
      tracker.on('gaze', (gazeData) => {
        const { x, y } = gazeData;
        onGaze(x, y);
        
        // Detect which card is being gazed at
        const cardElement = document.elementFromPoint(x, y);
        if (cardElement && cardElement.closest('.Tile')) {
          const cardId = cardElement.closest('.Tile').dataset.tileId;
          
          if (cardId !== currentCard) {
            currentCard = cardId;
            dwellStartTime = Date.now();
          } else {
            const dwellDuration = Date.now() - dwellStartTime;
            if (dwellDuration >= dwellThreshold) {
              onDwell(cardId, x, y, dwellDuration);
              dwellStartTime = null;
              currentCard = null;
            }
          }
        } else {
          dwellStartTime = null;
          currentCard = null;
        }
      });
    }
  }
}

export default {
  SwitchDeviceDetector,
  EyeTrackingDetector
};

