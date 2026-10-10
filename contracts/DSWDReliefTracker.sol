// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DSWDReliefTracker is ERC1155, IERC1155Receiver, Ownable, ReentrancyGuard {
    uint256 public currentBatchId;
    uint256 public currentHandoverId;

    mapping(address => bool) public isAuthorizedAdmin;

    enum HandoverStatus {
        None,
        Released,
        Transshipped,
        Accepted,
        Cancelled
    }

    struct Batch {
        uint256 batchId;
        string manifestNumber;
        string batchTokenId;
        string manifestHash;
        string category;
        uint256 quantity;
        string destination;
        address mintedBy;
        uint256 mintedAt;
    }

    struct CustodyHop {
        address fromParty;
        address toParty;
        string gps;
        uint256 timestamp;
        string note;
    }

    struct Handover {
        uint256 handoverId;
        string drNumber;
        string handoverContractId;
        string category;
        uint256 quantity;
        string[] batchTokenIds;
        uint256[] batchQuantities;
        string fromLocation;
        string destination;
        address currentCustodian;     // Active verified custodian (Driver A, Driver B, or LGU)
        address designatedDriver;     // Initially assigned transport driver
        address receiver;             // Final accepted recipient
        string senderGps;
        string receiverGps;
        uint256 releasedAt;
        uint256 acceptedAt;
        HandoverStatus status;
        uint256 hopCount;
    }

    mapping(uint256 => Batch) public batches;
    mapping(string => uint256) public batchIdByTokenId;
    mapping(string => uint256) public batchIdByManifestNumber;

    // Handover storage
    mapping(uint256 => Handover) private handovers;
    mapping(string => uint256) public handoverIdByDrNumber;
    mapping(string => uint256) public handoverIdByContractId;

    // Dynamic Multi-Hop Custody Array: logs all legs of the journey
    mapping(uint256 => CustodyHop[]) public handoverHops;

    event AdminAuthorized(address indexed admin);
    event AdminRevoked(address indexed admin);

    event BatchTokenMinted(
        uint256 indexed batchId,
        string manifestNumber,
        string batchTokenId,
        address indexed mintedBy
    );

    event ReleaseSigned(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
        address indexed custodian
    );

    event CustodyTransshipped(
        uint256 indexed handoverId,
        string drNumber,
        address indexed previousDriver,
        address indexed newDriver,
        string gps,
        uint256 timestamp
    );

    event ReceiptConfirmed(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
        string receiverGps,
        address indexed receiver
    );

    event TruckLocationRecorded(
        string indexed shipmentId,
        string truckId,
        string latitude,
        string longitude,
        uint256 timestamp,
        address indexed recordedBy
    );

    modifier onlyAdmin() {
        require(
            msg.sender == owner() || isAuthorizedAdmin[msg.sender],
            "Admin only"
        );
        _;
    }

    constructor() ERC1155("") Ownable(msg.sender) {
        isAuthorizedAdmin[msg.sender] = true;
        emit AdminAuthorized(msg.sender);
    }

    // ERC-1155 Receiver Interface Implementation: enables contract to hold tokens in Escrow
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function setAdmin(address admin, bool authorized) external onlyOwner {
        require(admin != address(0), "Invalid admin address");
        isAuthorizedAdmin[admin] = authorized;
        if (authorized) {
            emit AdminAuthorized(admin);
        } else {
            emit AdminRevoked(admin);
        }
    }

    function _storeBatch(
        uint256 id,
        string memory manifestNumber,
        string memory batchTokenId,
        string memory manifestHash,
        string memory category,
        uint256 quantity,
        string memory destination
    ) internal {
        Batch storage b = batches[id];
        b.batchId = id;
        b.manifestNumber = manifestNumber;
        b.batchTokenId = batchTokenId;
        b.manifestHash = manifestHash;
        b.category = category;
        b.quantity = quantity;
        b.destination = destination;
        b.mintedBy = msg.sender;
        b.mintedAt = block.timestamp;

        batchIdByTokenId[batchTokenId] = id;
        batchIdByManifestNumber[manifestNumber] = id;
    }

    // Mints goods directly into the DSWD Smart Contract Escrow Vault
    function mintBatchToken(
        string memory manifestNumber,
        string memory batchTokenId,
        string memory manifestHash,
        string memory category,
        uint256 quantity,
        string memory destination
    ) external onlyAdmin nonReentrant returns (uint256) {
        require(quantity > 0, "Invalid qty");
        require(bytes(manifestNumber).length > 0, "Manifest required");
        require(bytes(batchTokenId).length > 0, "Batch ID required");
        require(bytes(manifestHash).length > 0, "Hash required");
        require(batchIdByTokenId[batchTokenId] == 0, "Batch exists");
        require(batchIdByManifestNumber[manifestNumber] == 0, "Manifest minted");

        currentBatchId += 1;
        uint256 newBatchId = currentBatchId;

        _storeBatch(newBatchId, manifestNumber, batchTokenId, manifestHash, category, quantity, destination);

        // Tokens minted into Escrow custody
        _mint(address(this), newBatchId, quantity, "");

        emit BatchTokenMinted(
            newBatchId,
            manifestNumber,
            batchTokenId,
            msg.sender
        );

        return newBatchId;
    }

    function _storeHandover(
        uint256 hid,
        string memory drNumber,
        string memory handoverContractId,
        string memory category,
        uint256 quantity,
        string memory fromLocation,
        string memory destination,
        string memory senderGps,
        address driver
    ) internal {
        Handover storage h = handovers[hid];
        h.handoverId = hid;
        h.drNumber = drNumber;
        h.handoverContractId = handoverContractId;
        h.category = category;
        h.quantity = quantity;
        h.fromLocation = fromLocation;
        h.destination = destination;
        h.currentCustodian = driver;
        h.designatedDriver = driver;
        h.senderGps = senderGps;
        h.releasedAt = block.timestamp;
        h.status = HandoverStatus.Released;
        h.hopCount = 1;

        // Record Hop 1: Warehouse -> Driver
        handoverHops[hid].push(CustodyHop({
            fromParty: msg.sender,
            toParty: driver,
            gps: senderGps,
            timestamp: block.timestamp,
            note: "Warehouse Dispatched to Driver"
        }));
    }

    function _executeReleaseBatchTransfers(
        uint256 hid,
        string[] memory batchTokenIds,
        uint256[] memory batchQuantities,
        uint256 expectedQuantity
    ) internal {
        uint256 allocatedTotal = 0;
        for (uint256 i = 0; i < batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[batchTokenIds[i]];
            require(batchId != 0, "Batch not found");
            require(batchQuantities[i] > 0, "Invalid batch qty");
            allocatedTotal += batchQuantities[i];

            // If tokens were previously held by external wallet, ensure transferred to escrow
            address tokenHolder = batches[batchId].mintedBy != address(0) ? batches[batchId].mintedBy : owner();
            if (balanceOf(address(this), batchId) < batchQuantities[i] && tokenHolder != address(this)) {
                _safeTransferFrom(tokenHolder, address(this), batchId, batchQuantities[i], "");
            }
        }
        require(allocatedTotal == expectedQuantity, "Batch qty mismatch");
        handovers[hid].batchTokenIds = batchTokenIds;
        handovers[hid].batchQuantities = batchQuantities;
    }

    // Backward-compatible 9-argument signRelease
    function signRelease(
        string memory drNumber,
        string memory handoverContractId,
        string memory category,
        uint256 quantity,
        string[] memory batchTokenIds,
        uint256[] memory batchQuantities,
        string memory fromLocation,
        string memory destination,
        string memory senderGps
    ) external returns (uint256) {
        return signReleaseWithDriver(
            drNumber,
            handoverContractId,
            category,
            quantity,
            batchTokenIds,
            batchQuantities,
            fromLocation,
            destination,
            senderGps,
            msg.sender
        );
    }

    // 10-argument signRelease explicitly binding the active transport driver
    function signReleaseWithDriver(
        string memory drNumber,
        string memory handoverContractId,
        string memory category,
        uint256 quantity,
        string[] memory batchTokenIds,
        uint256[] memory batchQuantities,
        string memory fromLocation,
        string memory destination,
        string memory senderGps,
        address designatedDriver
    ) public returns (uint256) {
        require(
            msg.sender == owner() || isAuthorizedAdmin[msg.sender] || isApprovedForAll(owner(), msg.sender),
            "Unauthorized sender"
        );
        require(quantity > 0, "Invalid qty");
        require(bytes(drNumber).length > 0, "DR required");
        require(bytes(handoverContractId).length > 0, "Handover required");
        require(bytes(senderGps).length > 0 && bytes(senderGps).length <= 100, "Invalid GPS");
        require(batchTokenIds.length > 0 && batchTokenIds.length == batchQuantities.length, "Invalid batches");
        require(handoverIdByDrNumber[drNumber] == 0, "DR released");
        require(handoverIdByContractId[handoverContractId] == 0, "Handover exists");

        address driver = designatedDriver != address(0) ? designatedDriver : msg.sender;

        currentHandoverId += 1;
        uint256 newHandoverId = currentHandoverId;

        _storeHandover(
            newHandoverId,
            drNumber,
            handoverContractId,
            category,
            quantity,
            fromLocation,
            destination,
            senderGps,
            driver
        );
        _executeReleaseBatchTransfers(newHandoverId, batchTokenIds, batchQuantities, quantity);

        handoverIdByDrNumber[drNumber] = newHandoverId;
        handoverIdByContractId[handoverContractId] = newHandoverId;

        emit ReleaseSigned(newHandoverId, drNumber, handoverContractId, driver);
        return newHandoverId;
    }

    // Optional Multi-Hop: Transshipment / Breakdown Handover (Driver A -> Driver B)
    function transferDriverCustody(
        string memory drNumber,
        address newDriver,
        string memory transferGps,
        string memory note
    ) external nonReentrant returns (uint256) {
        uint256 hid = handoverIdByDrNumber[drNumber];
        require(hid != 0, "Handover not found");
        Handover storage h = handovers[hid];
        require(
            h.status == HandoverStatus.Released || h.status == HandoverStatus.Transshipped,
            "Not in transit"
        );
        require(newDriver != address(0), "Invalid driver");
        require(
            msg.sender == owner() || isAuthorizedAdmin[msg.sender] || msg.sender == h.currentCustodian,
            "Unauthorized to transfer custody"
        );

        address previousDriver = h.currentCustodian;
        h.currentCustodian = newDriver;
        h.status = HandoverStatus.Transshipped;
        h.hopCount += 1;

        handoverHops[hid].push(CustodyHop({
            fromParty: previousDriver,
            toParty: newDriver,
            gps: transferGps,
            timestamp: block.timestamp,
            note: bytes(note).length > 0 ? note : "Mid-Route Transshipment"
        }));

        emit CustodyTransshipped(hid, drNumber, previousDriver, newDriver, transferGps, block.timestamp);
        return hid;
    }

    // Backward-compatible 4-argument confirmReceipt
    function confirmReceipt(
        string memory drNumber,
        string memory handoverContractId,
        string memory destination,
        string memory receiverGps
    ) external nonReentrant returns (uint256) {
        return confirmReceiptForLgu(
            drNumber,
            handoverContractId,
            destination,
            receiverGps,
            msg.sender
        );
    }

    // 5-argument confirmReceipt releasing tokens from Escrow directly into the verified LGU wallet
    function confirmReceiptForLgu(
        string memory drNumber,
        string memory handoverContractId,
        string memory destination,
        string memory receiverGps,
        address targetLguRecipient
    ) public nonReentrant returns (uint256) {
        require(bytes(receiverGps).length > 0 && bytes(receiverGps).length <= 100, "Invalid GPS");

        uint256 handoverId = handoverIdByDrNumber[drNumber];
        require(handoverId != 0, "Handover not found");

        Handover storage handover = handovers[handoverId];
        require(
            handover.status == HandoverStatus.Released || handover.status == HandoverStatus.Transshipped,
            "Not releasable"
        );
        require(
            keccak256(bytes(handover.handoverContractId)) == keccak256(bytes(handoverContractId)),
            "ID mismatch"
        );
        require(
            bytes(destination).length == 0 ||
                keccak256(bytes(handover.destination)) == keccak256(bytes(destination)),
            "Dest mismatch"
        );

        address finalRecipient = targetLguRecipient != address(0) ? targetLguRecipient : msg.sender;
        address deliveringDriver = handover.currentCustodian;

        handover.receiver = finalRecipient;
        handover.currentCustodian = finalRecipient;
        handover.receiverGps = receiverGps;
        handover.acceptedAt = block.timestamp;
        handover.status = HandoverStatus.Accepted;
        handover.hopCount += 1;

        // Record final Hop into on-chain custody array
        handoverHops[handoverId].push(CustodyHop({
            fromParty: deliveringDriver,
            toParty: finalRecipient,
            gps: receiverGps,
            timestamp: block.timestamp,
            note: "LGU Delivery Confirmed"
        }));

        // Escrow Release: Transfer ERC-1155 tokens directly from address(this) to LGU
        for (uint256 i = 0; i < handover.batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[handover.batchTokenIds[i]];
            _safeTransferFrom(address(this), finalRecipient, batchId, handover.batchQuantities[i], "");
        }

        emit ReceiptConfirmed(handoverId, drNumber, handoverContractId, receiverGps, finalRecipient);
        return handoverId;
    }

    // View Getters
    function getHandoverHops(uint256 handoverId) external view returns (CustodyHop[] memory) {
        return handoverHops[handoverId];
    }

    function getHandover(uint256 handoverId) external view returns (Handover memory) {
        return handovers[handoverId];
    }

    function getBatchByTokenId(string memory batchTokenId) external view returns (Batch memory) {
        uint256 batchId = batchIdByTokenId[batchTokenId];
        require(batchId != 0, "Batch not found");
        return batches[batchId];
    }

    function recordTruckLocation(
        string memory shipmentId,
        string memory truckId,
        string memory latitude,
        string memory longitude,
        uint256 timestamp
    ) external onlyAdmin {
        require(bytes(shipmentId).length > 0, "Shipment ID required");
        require(bytes(truckId).length > 0, "Truck ID required");
        require(timestamp > 0, "Invalid timestamp");

        emit TruckLocationRecorded(
            shipmentId,
            truckId,
            latitude,
            longitude,
            timestamp,
            msg.sender
        );
    }
}
