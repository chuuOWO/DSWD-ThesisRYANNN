// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DSWDReliefTracker is ERC1155, Ownable, ReentrancyGuard {
    uint256 public currentBatchId;
    uint256 public currentHandoverId;

    mapping(address => bool) public isAuthorizedAdmin;

    enum HandoverStatus {
        None,
        Released,
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
        string senderGps;
        string receiverGps;
        address sender;
        address receiver;
        uint256 releasedAt;
        uint256 acceptedAt;
        HandoverStatus status;
    }

    mapping(uint256 => Batch) public batches;
    mapping(string => uint256) public batchIdByTokenId;
    mapping(string => uint256) public batchIdByManifestNumber;

    // Handover storage kept private to avoid compiler stack overflow on auto-generated getters
    mapping(uint256 => Handover) private handovers;
    mapping(string => uint256) public handoverIdByDrNumber;
    mapping(string => uint256) public handoverIdByContractId;

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
        address indexed sender
    );

    event ReceiptConfirmed(
        uint256 indexed handoverId,
        string drNumber,
        string handoverContractId,
        string receiverGps,
        address indexed receiver
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

        _mint(msg.sender, newBatchId, quantity, "");

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
        string memory senderGps
    ) internal {
        Handover storage h = handovers[hid];
        h.handoverId = hid;
        h.drNumber = drNumber;
        h.handoverContractId = handoverContractId;
        h.category = category;
        h.quantity = quantity;
        h.fromLocation = fromLocation;
        h.destination = destination;
        h.senderGps = senderGps;
        h.sender = msg.sender;
        h.releasedAt = block.timestamp;
        h.status = HandoverStatus.Released;
    }

    function _executeReleaseBatchTransfers(
        uint256 hid,
        string[] memory batchTokenIds,
        uint256[] memory batchQuantities,
        uint256 expectedQuantity,
        address sender
    ) internal {
        uint256 allocatedTotal = 0;
        for (uint256 i = 0; i < batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[batchTokenIds[i]];
            require(batchId != 0, "Batch not found");
            require(batchQuantities[i] > 0, "Invalid batch qty");
            allocatedTotal += batchQuantities[i];

            address tokenHolder = batches[batchId].mintedBy != address(0) ? batches[batchId].mintedBy : owner();
            if (tokenHolder != sender) {
                _safeTransferFrom(tokenHolder, sender, batchId, batchQuantities[i], "");
            }
        }
        require(allocatedTotal == expectedQuantity, "Batch qty mismatch");
        handovers[hid].batchTokenIds = batchTokenIds;
        handovers[hid].batchQuantities = batchQuantities;
    }

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

        currentHandoverId += 1;
        uint256 newHandoverId = currentHandoverId;

        _storeHandover(newHandoverId, drNumber, handoverContractId, category, quantity, fromLocation, destination, senderGps);
        _executeReleaseBatchTransfers(newHandoverId, batchTokenIds, batchQuantities, quantity, msg.sender);

        handoverIdByDrNumber[drNumber] = newHandoverId;
        handoverIdByContractId[handoverContractId] = newHandoverId;

        emit ReleaseSigned(newHandoverId, drNumber, handoverContractId, msg.sender);
        return newHandoverId;
    }

    function confirmReceipt(
        string memory drNumber,
        string memory handoverContractId,
        string memory destination,
        string memory receiverGps
    ) external nonReentrant returns (uint256) {
        require(bytes(receiverGps).length > 0 && bytes(receiverGps).length <= 100, "Invalid GPS");

        uint256 handoverId = handoverIdByDrNumber[drNumber];
        require(handoverId != 0, "Handover not found");

        Handover storage handover = handovers[handoverId];
        require(handover.status == HandoverStatus.Released, "Not releasable");
        require(
            keccak256(bytes(handover.handoverContractId)) == keccak256(bytes(handoverContractId)),
            "ID mismatch"
        );
        require(
            bytes(destination).length == 0 ||
                keccak256(bytes(handover.destination)) == keccak256(bytes(destination)),
            "Dest mismatch"
        );

        handover.receiver = msg.sender;
        handover.receiverGps = receiverGps;
        handover.acceptedAt = block.timestamp;
        handover.status = HandoverStatus.Accepted;

        for (uint256 i = 0; i < handover.batchTokenIds.length; i++) {
            uint256 batchId = batchIdByTokenId[handover.batchTokenIds[i]];
            _safeTransferFrom(handover.sender, msg.sender, batchId, handover.batchQuantities[i], "");
        }

        emit ReceiptConfirmed(handoverId, drNumber, handoverContractId, receiverGps, msg.sender);
        return handoverId;
    }

    function getBatchByTokenId(string memory batchTokenId) external view returns (Batch memory) {
        uint256 batchId = batchIdByTokenId[batchTokenId];
        require(batchId != 0, "Batch not found");
        return batches[batchId];
    }
}
