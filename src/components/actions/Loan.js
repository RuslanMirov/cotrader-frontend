import React, { Component } from 'react'
import { Button, Modal, Form } from "react-bootstrap"
import { NeworkID, ERC20ABI, CTokenABI, SmartFundABIV5 } from '../../config.js'
//import axios from 'axios'
import { Typeahead } from 'react-bootstrap-typeahead'
import setPending from '../../utils/setPending'
import { toWeiByDecimalsInput, fromWeiByDecimalsInput } from '../../utils/weiByDecimals'
import { toWei } from 'web3-utils'

class PoolModal extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      Show: false,
      symbols: [],
      tokens:[],
      cTokenAddress:'',
      action:'Loan',
      amount:0,
      percent:50
    }
  }

  _isMounted = false
  componentDidMount(){
    this._isMounted = true
    this.initData()

  }

  componentWillUnmount(){
    this._isMounted = false
  }

  initData = async () => {
    let symbols
    let tokens
    if(NeworkID === 1){
      symbols = ['cDAI', 'cETH', 'cBAT', 'cREP', 'cSAI', 'cUSDC', 'cWBTC', 'cZRX']
      tokens =  [
        {symbol:'cDAI', address:'0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'},
        {symbol:'cETH', address:'0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5'},
        {symbol:'cBAT', address:'0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e'},
        {symbol:'cREP', address:'0x158079ee67fce2f58472a96584a73c7ab9ac95c1'},
        {symbol:'cSAI', address:'0xf5dce57282a584d2746faf1593d3121fcac444dc'},
        {symbol:'cUSDC', address:'0x39aa39c021dfbae8fac545936693ac917d5e7563'},
        {symbol:'cWBTC', address:'0xc11b1268c1a384e55c48c2391d8d480264a3a7f4'},
        {symbol:'cZRX', address:'0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407'}
      ]
    }
    else if(NeworkID === 3){
       symbols = ['cDAI', 'cETH']
       tokens =  [
         {symbol:'cDAI', address:'0x6ce27497a64fffb5517aa4aee908b1e7eb63b9ff'},
         {symbol:'cETH', address:'0x1d70b01a2c3e3b2e56fcdcefe50d5c5d70109a5d'}]
    }else{
      alert('There are no data for Your network')
    }

    this.setState({ symbols, tokens })
  }

  findAddressBySymbol = (symbol) => {
    const tokenObj = this.state.tokens.find((item) => item.symbol && item.symbol === symbol)
    if(tokenObj){
      return tokenObj.address
    }else{
      return null
    }
  }


  // return from wei ETH or ERC20
  getFundBalanceForLoan = async () => {
    // check ETH balance
    if(this.state.cTokenAddress === this.findAddressBySymbol('cETH')){
      const ethBalance = await this.props.web3.eth.getBalance(this.props.smartFundAddress)
      return this.props.web3.utils.fromWei(ethBalance)
    }
    // check erc20 token balance
    else{
      const cToken = new this.props.web3.eth.Contract(CTokenABI, this.state.cTokenAddress)
      const tokenAddress = await cToken.methods.underlying().call()
      const ercToken = new this.props.web3.eth.Contract(ERC20ABI, tokenAddress)
      const ercBalance = await ercToken.methods.balanceOf(this.props.smartFundAddress).call()
      const decimals = ercToken.methods.decimals().call()
      return fromWeiByDecimalsInput(decimals, ercBalance)
    }
  }

  getCETHWeiByDecimals = async () => {
    if(this.state.cTokenAddress === this.findAddressBySymbol('cETH')){
      return toWei(String(this.state.amount))
    }else{
      const cToken = new this.props.web3.eth.Contract(CTokenABI, this.state.cTokenAddress)
      const decimals = await cToken.methods.decimals.call()
      return toWeiByDecimalsInput(decimals, String(this.state.amount))
    }
  }

  compoundMint = async () => {
    if(this.state.amount > 0 && this.state.cTokenAddress){
      const curBalance = await this.getFundBalanceForLoan()
      if(curBalance >= this.state.amount){
        const fund = new this.props.web3.eth.Contract(SmartFundABIV5, this.props.smartFundAddress)
        const block = await this.props.web3.eth.getBlockNumber()
        const weiInput = await this.getCETHWeiByDecimals()

        // Mint
        fund.methods.compoundMint(weiInput, this.state.cTokenAddress)
        .send({ from:this.props.accounts[0] })
        .on('transactionHash', (hash) => {
        // pending status for spiner
        this.props.pending(true)
        // pending status for DB
        setPending(this.props.smartFundAddress, 1, this.props.accounts[0], block, hash, "Trade")
        })
        // close pool modal
        this.modalClose()
      }else{
        alert('Your fund not have enough balance')
      }
    }else{
      alert('Please fill all fields')
    }
  }

  compoundRedeem = async () => {
    if(this.state.percent > 0 && this.state.percent <= 100 && this.state.cTokenAddress){
      const fund = new this.props.web3.eth.Contract(SmartFundABIV5, this.props.smartFundAddress)
      const block = await this.props.web3.eth.getBlockNumber()
      // Mint
      fund.methods.compoundRedeemByPercent(this.state.percent, this.state.cTokenAddress)
      .send({ from:this.props.accounts[0] })
      .on('transactionHash', (hash) => {
      // pending status for spiner
      this.props.pending(true)
      // pending status for DB
      setPending(this.props.smartFundAddress, 1, this.props.accounts[0], block, hash, "Trade")
      })
      // close pool modal
      this.modalClose()
    }else{
      alert('Please fill all fields correct')
    }
  }


  renderAction(){
    if(this.state.action === "Loan"){
      return(
        <React.Fragment>
        <Form.Control
        type="number"
        min="0"
        placeholder="Enter amount to lend"
        name="amount"
        onChange={(e) => this.setState({ amount:e.target.value })}
        />
        <br/>
        <Button
        variant="outline-primary"
        type="button"
        onClick={() => this.compoundMint()}
        >
        Loan
        </Button>
        </React.Fragment>
      )
    }
    else if (this.state.action === "Redeem") {
      return(
        <React.Fragment>
        <Form.Label>Reedem percent {this.state.percent} %</Form.Label>
        <Form.Control
        type="range"
        min="1"
        max="100"
        placeholder="Enter percent for withdraw"
        onChange={(e) => this.setState({ percent:e.target.value })}
        />
        <br/>
        <Button
        variant="outline-primary"
        type="button"
        onClick={() => this.compoundRedeem()}
        >
        Redeem
        </Button>
        </React.Fragment>
      )
    }
    else{
      return null
    }
  }

  modalClose = () => this.setState({ Show: false, action:'Loan' })
  render() {
    return (
      <React.Fragment>
      <Button variant="outline-primary" className="buttonsAdditional" onClick={() => this.setState({ Show: true })}>
        Loan
      </Button>

      <Modal
        show={this.state.Show}
        onHide={() => this.modalClose()}
      >
        <Modal.Header closeButton>
        <Modal.Title>
        Loan
        </Modal.Title>
        </Modal.Header>
        <Modal.Body>
        <Form>
        <Form.Group controlId="exampleForm.ControlSelect1">
        <Form.Label>Select Compound action</Form.Label>
        <Form.Control
         as="select"
         size="sm"
         onChange={(e) => this.setState({ action:e.target.value })}
         >
          <option>Loan</option>
          <option>Redeem</option>
        </Form.Control>
        </Form.Group>

        <Typeahead
          labelKey="compoundSymbols"
          multiple={false}
          id="compoundSymbols"
          options={this.state.symbols}
          onChange={(s) => this.setState({cTokenAddress: this.findAddressBySymbol(s[0])})}
          placeholder="Choose a symbol"
        />
        <br/>

        <Form.Group>
        {
          this.renderAction()
        }
        </Form.Group>
        </Form>
        </Modal.Body>
      </Modal>

      </React.Fragment>
    )
  }
}

export default PoolModal
