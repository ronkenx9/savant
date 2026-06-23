// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title AgentINFT — Tradeable Trained Agents
/// @notice ERC-7857-inspired Intelligent NFT. Each token owns a pointer to its
///         agent's *trained state* held on 0G Storage. The state pointer is keyed
///         by tokenId, so when the token is sold the learned intelligence travels
///         with it. This is the irreducible 0G dependency: the asset being sold IS
///         the on-chain-owned, off-chain-stored state — not a row in a private DB.
/// @dev    MVP simplification vs. full ERC-7857: the state root is stored in the
///         clear (public 0G Storage) rather than encrypted with oracle-gated
///         re-encryption on transfer. The transferable-intelligence mechanic is
///         identical; encryption + sealed-key handoff is the round-3 hardening.
contract AgentINFT is ERC721 {
    struct Agent {
        string name;          // human label
        string stateRoot;     // 0G Storage root hash of the trained-state doc
        uint256 version;      // bumps every training distillation
        uint256 intelligence; // 0..100 training meter, derived from state richness
        uint256 trainedAt;    // last evolve() timestamp
        address origin;       // original trainer (for future resale royalties)
    }

    uint256 public nextId = 1;
    mapping(uint256 => Agent) public agents;

    // minimal marketplace: tokenId => price in wei (0 = not listed)
    mapping(uint256 => uint256) public listingPrice;

    // Resale royalty to the ORIGINAL trainer. The person who made the agent smart
    // keeps earning when their trained agent changes hands again. This is what
    // turns "train agents to sell" into a real economy. No royalty on the first
    // sale (seller == origin) — only on resales.
    uint256 public constant ROYALTY_BPS = 500; // 5%
    uint256 private constant BPS_DENOM = 10_000;

    event AgentMinted(uint256 indexed tokenId, address indexed owner, string name);
    event AgentEvolved(
        uint256 indexed tokenId,
        uint256 version,
        uint256 intelligence,
        string stateRoot
    );
    event AgentListed(uint256 indexed tokenId, uint256 price);
    event AgentUnlisted(uint256 indexed tokenId);
    event AgentSold(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );
    event RoyaltyPaid(
        uint256 indexed tokenId,
        address indexed origin,
        uint256 amount
    );

    constructor() ERC721("Savant Agent", "SAVANT") {}

    // ─────────────────────────────────────────────────────────────────────────
    // Mint a blank agent. Knows nothing yet: version 0, intelligence 0, no state.
    // ─────────────────────────────────────────────────────────────────────────
    function mint(string calldata name) external returns (uint256 tokenId) {
        tokenId = nextId++;
        _safeMint(msg.sender, tokenId);
        agents[tokenId] = Agent({
            name: name,
            stateRoot: "",
            version: 0,
            intelligence: 0,
            trainedAt: 0,
            origin: msg.sender
        });
        emit AgentMinted(tokenId, msg.sender, name);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Record a training distillation: the off-chain pipeline merged a session
    // into the state doc, re-pinned it to 0G Storage, and reports the new root.
    // The changing stateRoot on this event is the "intelligence is mutating on
    // 0G" signal the demo surfaces live.
    // ─────────────────────────────────────────────────────────────────────────
    function evolve(
        uint256 tokenId,
        string calldata stateRoot,
        uint256 intelligence
    ) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(intelligence <= 100, "intelligence > 100");
        Agent storage a = agents[tokenId];
        a.stateRoot = stateRoot;
        a.intelligence = intelligence;
        a.version += 1;
        a.trainedAt = block.timestamp;
        emit AgentEvolved(tokenId, a.version, intelligence, stateRoot);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Marketplace: list / unlist / buy. The trained state is not touched here —
    // it rides along because it is keyed by tokenId. Buyer inherits a smart agent.
    // ─────────────────────────────────────────────────────────────────────────
    function list(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(price > 0, "price = 0");
        listingPrice[tokenId] = price;
        emit AgentListed(tokenId, price);
    }

    function unlist(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        listingPrice[tokenId] = 0;
        emit AgentUnlisted(tokenId);
    }

    function buy(uint256 tokenId) external payable {
        uint256 price = listingPrice[tokenId];
        require(price > 0, "not listed");
        require(msg.value >= price, "underpaid");
        address seller = ownerOf(tokenId);
        require(seller != msg.sender, "already owner");

        listingPrice[tokenId] = 0;
        _transfer(seller, msg.sender, tokenId);

        // Pay the original trainer a royalty on resales (not the first sale).
        // A failed royalty transfer must NOT brick the sale (origin could be a
        // contract that rejects ETH) — in that case the royalty folds back into
        // the seller's proceeds so the trade always settles.
        address origin = agents[tokenId].origin;
        uint256 royalty = 0;
        if (seller != origin && origin != address(0)) {
            uint256 r = (price * ROYALTY_BPS) / BPS_DENOM;
            if (r > 0) {
                (bool rok, ) = payable(origin).call{value: r}("");
                if (rok) {
                    royalty = r;
                    emit RoyaltyPaid(tokenId, origin, r);
                }
            }
        }

        (bool ok, ) = payable(seller).call{value: price - royalty}("");
        require(ok, "pay seller failed");
        if (msg.value > price) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refunded, "refund failed");
        }
        emit AgentSold(tokenId, seller, msg.sender, price);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────
    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        require(_ownerOf(tokenId) != address(0), "no token");
        return agents[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return nextId - 1;
    }
}
