/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_ArchivoEnvioITAU_MPRD_V2.0.js     	       ||
||                                                             ||
||  Version Date         Author        Remarks                 ||
||  1.0     Mar 16 2020  LatamReady    Use Script 2.0          ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/email', 'N/config', 'N/file', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function(log, record, search, format, runtime, email, config, file, libraryMail) {

    //Datos de la Configuracion (Subsidiaria - ITAU)
    var codigoBeneficiario = '';
    var codigoCartera = '';
    var codigoBanco = '';
    var aceptacion = '';
    var agencia = '';

    //Datos del banco
    var nombreBanco = 'BANCO ITAU SA';
    var ID_BANK = '';

    //Datos de la Subsidiaria/Beneficiario
    var nombreSubsidiaria = '';
    var cnpjSubsidiaria = '';
    var ID_SUBSIDIARY = '';

    //Para el nombre del archivo de envio
    var file_name = '';
    var formatoFechaNameFile = '';
    var COD_EMPRESA= '';
    var NOSSO_COD = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer = '';
    var tipoCustomer = '';
    var bairroCustomer = '';
    var cepCustomer = '';
    var ciudadCustomer = '';
    var ufCustomer = '';
    var ID_CUSTOMER = '';

    //Datos del Invoice
    var dateInvoice = '';
    var dueDateInvoice = '';
    var montoTotalInvoice = '';
    var numPreImpreso = '';
    var dataVencimiento = '';
    var ID_INVOICE = '';

    //Datos para el Archivo de Envio
    var complementoRegistro = '';
    var literalServicio = 'COBRANCA'

    //Datos del Transaction Fields
    var codigoOcurrenciaRemesa = '';
    var codigoEspecieDoc = '';
    var MORA_DIA = '';
    var MULTA = '';
    var formatoFechaMulta = '';

    //Datos Installments
    var ID_INST = '';
    var AMOUNT_INST = '';
    var DUEDATE_INST = '';
    var RETENCION_INST = '';

    // FEATURE SUITETAX
    var ST_FEATURE = false;

    var LMRY_script = 'LatamReady - Archivo de Envio ITAU MPRD';
    var FLAG = false;

    // Use the getInputData function to return two strings.
    function getInputData() {
      try {
        //Crea la carpeta si no existe
        search_folder();

        var id_recordLog = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_recordlogid_itau_mprd'});

        var record_br_log_shipping_file = search.lookupFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_recordLog,
          columns: ['custrecord_lmry_br_log_subsidiary', 'custrecord_lmry_br_log_bank', 'custrecord_lmry_br_log_date_from', 'custrecord_lmry_br_log_date_to']
        });

        var subsidiaria = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;
        var bank = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;
        var fecha_desde = record_br_log_shipping_file.custrecord_lmry_br_log_date_from;
        var fecha_hasta = record_br_log_shipping_file.custrecord_lmry_br_log_date_to;

        //Búsqueda de invoices
        var columns = [
          'trandate', 'subsidiary',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_pdf_bank',
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_multa",
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_interes"
        ];

        //Features
        var licenses = libraryMail.getLicenses(subsidiaria);
        var FEATURE_INST = runtime.isFeatureInEffect({feature: "installments"});

        if ((FEATURE_INST == 'T' || FEATURE_INST == true )&& libraryMail.getAuthorization(536, licenses)) {
          columns.push(search.createColumn({name: "internalid",sort: search.Sort.DESC}));
          columns.push(search.createColumn({name: "installmentnumber",join: "installment",sort: search.Sort.ASC}));
          columns.push("custrecord_lmry_br_related_transaction.custrecord_lmry_br_installments");
          columns.push("installment.amount");
          columns.push("installment.duedate");
        }

        return search.create({
          type: 'invoice',
          columns: columns,
          filters: [
            ["mainline", "is", "T"],
            "AND", ["subsidiary", "is", subsidiaria],
            "AND", ["trandate", "within", fecha_desde, fecha_hasta],
            "AND", ["custrecord_lmry_br_related_transaction.custrecord_lmry_br_pdf_bank", "anyof", bank],
            "AND", ["status", "anyof", "CustInvc:A"]
          ],
          settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
        });

      }catch (error){
        log.error('Error', error);
        libraryMail.sendemail(' [ getInputData ] ' + error, LMRY_script);
        return true;
      }
    }

    function map(context) {
      try {
        var searchResult = JSON.parse(context.value);
        //Key
        var trandate = searchResult.values.trandate;

        //Datos del invoice
        ID_INVOICE = searchResult.id;
        ID_SUBSIDIARY = searchResult.values.subsidiary.value;
        ID_BANK = searchResult.values['custrecord_lmry_br_pdf_bank.custrecord_lmry_br_related_transaction'].value;
        MORA_DIA = searchResult.values['custrecord_lmry_br_send_interes.custrecord_lmry_br_related_transaction'];
        MULTA = searchResult.values['custrecord_lmry_br_send_multa.custrecord_lmry_br_related_transaction'];
        RETENCION_INST = searchResult.values['custrecord_lmry_br_installments.custrecord_lmry_br_related_transaction'];
        ID_INST =  searchResult.values["installmentnumber.installment"];
        AMOUNT_INST =  searchResult.values["amount.installment"];
        DUEDATE_INST =  searchResult.values["duedate.installment"];

        obtenerDatosSubsidiaria();
        obtenerDatosConfigSubsidiariaBancoITAU();

        context.write({
          key: trandate,
          value: obtenerDetalleRegistroObli()
        });

      } catch (error) {
        log.error('invoiceID - Trandate', ID_INVOICE + ' - ' + trandate);
        context.write({key: 0,value: ID_INVOICE});
        libraryMail.sendemail(' [ map ] ' + error, LMRY_script);
        return true;
      }
    }

    // The summarize stage is a serial stage, so this function is invoked only one time.
    function summarize(context) {
      try {
      var detalleObligatorio_array = {};
      var id_file_array = [];

      context.output.iterator().each(function(key, value) {
        if (detalleObligatorio_array[key]) {
          detalleObligatorio_array[key].push(value);
        } else {
          detalleObligatorio_array[key] = [value];
        }
        return true;
      });

      if (detalleObligatorio_array.length == 0)
        throw 'There is not content.';

      // ID de la carpeta contenedora de los Archivos de envío
      var id_folder = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_arquivo_remessa'});

      //ID del registro LatamReady - BR Log Shipping File
      var id_record_log = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_recordlogid_itau_mprd'});

      var record_br_log_shipping_file = search.lookupFields({
        type: 'customrecord_lmry_br_log_shipping_file',
        id: id_record_log,
        columns: ['custrecord_lmry_br_log_subsidiary', 'custrecord_lmry_br_log_bank']
      });

      ID_SUBSIDIARY = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;
      ID_BANK = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;

      var cabecera = obtenerCabeceraArchivo();

      for (var fecha in detalleObligatorio_array){

      var cadena = cabecera;
      var j = 0;

      //Iteracion de los valores del registro de detalle obligatorio
      for (var i = 0; i < detalleObligatorio_array[fecha].length; i++){
        cadena += concatenarSecuencia(detalleObligatorio_array[fecha][i].substring(0,396), j + 2);
        cadena += '\r\n';
        cadena += concatenarSecuencia(detalleObligatorio_array[fecha][i].substring(396,790), j + 3);
        j=j+2;
      }

        cadena += '\r\n';
        cadena += obtenerTrailerArchivo(j + 2);
        cadena += '\r\n';
        cadena = ValidarCaracteres_Especiales(cadena);

        //Guardando el archivo.rem del Archivo de Remessa
        formatoFecha(fecha);
        var fileRemesa = file.create({
          name: ID_SUBSIDIARY + formatoFechaNameFile + '.rem',
          fileType: file.Type.PLAINTEXT,
          contents: cadena,
          folder: id_folder
        });

        var id_file = fileRemesa.save();
        //Se genera los Id de los archivos de remesa por cada dia(fecha)
        id_file_array.push(id_file);
      }

      //Cambiando el estado al registro  "LatamReady - BR Shipping File" - Finalized
      record.submitFields({
        type: 'customrecord_lmry_br_log_shipping_file',
        id: id_record_log,
        values: {
        custrecord_lmry_br_log_idfile: id_file_array.join('|'),
        custrecord_lmry_br_log_state: 'Finalized'
      },
        option: {
        disableTriggers: true // con esto se evita que se bloquee el record, osea que no funcione los userevent
      }
      });


      } catch (error) {
        log.error('summarize', error);
        var id_record_log = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_recordlogid_itau_mprd'});

        //Cambiando el estado al registro  "LatamReady - BR Shipping File" - ERROR
        record.submitFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          values: {
            custrecord_lmry_br_log_state: 'Error'
          },
          option: {
            disableTriggers: true // con esto se evita que se bloquee el record, osea que no funcione los userevent
          }

        });

        libraryMail.sendemail(' [ summarize ] ' + error, LMRY_script);
        return true;
      }
    }

    function ValidarCaracteres_Especiales(s) {
      var AccChars = "ŠŽšžŸÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöùúûüýÿ°–—ªº·";
      var RegChars = "SZszYAAAAAACEEEEIIIIDNOOOOOUUUUYaaaaaaceeeeiiiidnooooouuuuyyo--ao.";
      s = s.toString();
      for (var c = 0; c < s.length; c++) {
        for (var special = 0; special < AccChars.length; special++) {
          if (s.charAt(c) == AccChars.charAt(special)) {
            s = s.substring(0, c) + RegChars.charAt(special) + s.substring(c + 1, s.length);
          }
        }
      }
      return s;
    }

    function reemplazarCaracteresEspeciales(cadena) {
      cadena = cadena.replace(/&gt;/g, '>');
      cadena = cadena.replace(/&lt;/g, '<');

      return cadena;
    }

    function concatenarSecuencia(texto, numeroSecuencia) {
      var numero = completarInicio(numeroSecuencia, 6, 0); // NÚMERO SEQÜENCIAL N(6) del Registro Obligatorio
      return texto + numero;
    }

    function obtenerDatosSubsidiaria() {

      if (ID_SUBSIDIARY != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var subsidiaria = record.load({
          type: record.Type.SUBSIDIARY,
          id: ID_SUBSIDIARY,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var subsidiary_nexus = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_itau_subsidiary_nexus' });
          var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var sub_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(subsidiary_nexus === sub_nexus){
              var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        var subsi_legalName = subsidiaria.getValue({fieldId: 'legalname'});

        if (subsi_legalName) {
          nombreSubsidiaria = subsi_legalName;
        } else {
          var subsi_name = subsidiaria.getValue({
            fieldId: 'name'
          });
          if (subsi_name)
            nombreSubsidiaria = subsi_name;
        }

        var subsi_cnpj = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          subsi_cnpj = subsidiaria.getValue({ fieldId: 'federalidnumber' });
        } else {
          subsi_cnpj = subsidiary_cnpj;
        }

        if (subsi_cnpj)
          cnpjSubsidiaria = subsi_cnpj;
      }
      return true;
    }

    function obtenerDatosConfigSubsidiariaBancoITAU() {
      //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsiiaria - ITAU
      var searchConfigSubsiBank = search.create({
        type: 'customrecord_lmry_br_config_bank_ticket',
        columns: [{
          name: 'custrecord_lmry_beneficiary_code'
        }, {
          name: 'custrecord_lmry_code_bank'
        }, {
          name: 'custrecord_lmry_bank_code_cartera'
        }, {
          name: 'custrecord_lmry_bank_accept_bank_ticket'
        }, {
          name: 'custrecord_lmry_bank_agency'
        }, {
          name: 'custrecord_lmry_file_name'
        }, {
          name: 'custrecord_lmry_br_docu_specie_code',
          join: 'CUSTRECORD_LMRY_BANK_ESPECIE_DOC',
          label: "BR CODIGO"
        }],
        filters: [
          ['custrecord_lmry_name_subsidiary', 'is', ID_SUBSIDIARY],
          'AND', ['custrecord_lmry_pdf_bank', 'is', ID_BANK]
        ]
      });
      var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

      if (searchResult != '' && searchResult != null) {
        var columns = searchResult[0].columns;

        codigoBeneficiario = searchResult[0].getValue(columns[0]);
        codigoBeneficiario = codigoBeneficiario.replace('-', '');

        codigoBanco = searchResult[0].getValue(columns[1]);

        codigoCartera = searchResult[0].getValue(columns[2]);

        aceptacion = searchResult[0].getValue(columns[3]);
        if (aceptacion == 1) {
          aceptacion = "A";
        } else {
          aceptacion = "N";
        }

        var agency = searchResult[0].getValue(columns[4]);
        if (agency)
          agencia = agency;


        var fileName = searchResult[0].getValue(columns[5]);
        if (fileName)
          file_name = fileName;

        var especieDoc_codigo = searchResult[0].getValue(columns[6]);
        if (especieDoc_codigo)
          codigoEspecieDoc = especieDoc_codigo;
      }
    }


    function formatoCNPJ(cnpj) {
      //Reemplaza el punto, el guion bajo y el slash por sin espacio, de manera global
      var cnpjEntidad = cnpj.replace(/\.|\-|\//g, '');
      return cnpjEntidad;
    }

    function obtenerCodigoOcurrenciayCodEspecieDoc() {
      try {
        //Busqueda del record customrecord_lmry_br_transaction_fields para obtener el codigo del campo LATAM - BR BB STATUS y tmb el codigo del campo LATAM - BR DOCUMENT SPECIE
        var searchBRTransactionFields = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: [{
            name: "custrecord_lmry_br_bb_code",
            join: "custrecord_lmry_br_bb_status",
            label: "LATAM - BR BB CODE"
          }, {
            name: "custrecord_lmry_br_docu_specie_code",
            join: "CUSTRECORD_LMRY_BR_DOCUMENT_SPECIE",
            label: "BR CODIGO"
          }],
          filters: ['custrecord_lmry_br_related_transaction', 'is', ID_INVOICE]
        });
        searchResult = searchBRTransactionFields.run().getRange(0, 1);
        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns

          var codigo_estado_boletoBancario = searchResult[0].getValue(columns[0]);
          if (codigo_estado_boletoBancario)
            codigoOcurrenciaRemesa = codigo_estado_boletoBancario;

          var codigo_documentoEspecie = searchResult[0].getValue(columns[1]);
          if (codigo_documentoEspecie)
            codigoEspecieDoc = codigo_documentoEspecie;
        }
      } catch (err) {
        libraryMail.sendemail(' [ obtenerCodigoOcurrenciayCodEspecieDoc ] ' + err, LMRY_script);
      }
    }

    function obtenerCabeceraArchivo() {
      obtenerDatosSubsidiaria();
      obtenerDatosConfigSubsidiariaBancoITAU();
      var string = "";

      string += '0'; // Tipo de Registro
      string += '1'; //Codigo de Remesa
      string += 'REMESSA'; //Literal Remessa
      string += '01'; //Codigo Servicio
      string += completarFinal(literalServicio, 15, ' '); //literalServicio
      string += completarInicio(agencia, 4, '0'); //Agencia N(4)
      string += '00'; //Complemento de Registro N(2)
      string += completarInicio(codigoBeneficiario, 6, '0'); //Conta y DAC
      string += completarInicio(complementoRegistro, 8, ' '); //Complemento de Registro A(8)
      string += completarFinal(nombreSubsidiaria, 30, ' '); //Nombre de la subsidiaria A(30)
      string += completarInicio(codigoBanco, 3, '0'); //codigoBanco N(3)
      string += completarFinal(nombreBanco, 15, ' '); //NOME DO BANCO A(15)
      var fechaCreacion = new Date();
      string += formatoFecha(fechaCreacion); //DDMMAA Fecha Grabacion del archivo de Remessa
      string += completarInicio(complementoRegistro, 294, ' '); //Complemento de Registro A(286)
      string += '000001'; //NÚMERO SEQÜENCIAL N(6)

      return string;
    }

    function obtenerDetalleRegistroObligatorio() {

      //Busqueda de Codigo de Ocurrencia y codigo del Especie de Doc en el BR-Transaction field
      obtenerCodigoOcurrenciayCodEspecieDoc();
      var string = "";
      var fecha_mora = '';

      if(MORA_DIA){
        MORA_DIA = formatoMonto(MORA_DIA);
        fecha_mora = dueDateInvoice;
      }

      string += '1'; //tipoRegistro
      string += '02' //tipoInscripcionEmpresa CNPJ (subsidiaria)
      cnpjSubsidiaria = formatoCNPJ(cnpjSubsidiaria);
      string += completarInicio(cnpjSubsidiaria, 14, '0'); // cnpjEmpresa
      string += completarInicio(agencia, 4, '0'); //Agencia N(4)
      string += '00'; //Complemento de Registro N(2)
      string += completarInicio(codigoBeneficiario, 6, '0'); //Conta y DAC
      string += completarInicio(complementoRegistro, 4, ' '); //Complemento de Registro A(4)
      string += completarInicio(complementoRegistro, 4, '0'); //INSTRUÇÃO/ALEGAÇÃO N(4)
      string += completarFinal(COD_EMPRESA, 25, ' '); // usoEmpresa A(25)
      string += completarInicio(NOSSO_COD, 8, '0'); // nossoNumero N(8)
      string += completarInicio(complementoRegistro, 13, '0'); // QTDE DE MOEDA N(13)
      string += completarInicio(codigoCartera, 3, '0') // Codigo Cartera N(3)
      string += completarInicio(complementoRegistro, 21, ' '); //USO DO BANCO A(21)
      string += 'I'; // letra de la CARTEIRA A(1)
      string += completarInicio(codigoOcurrenciaRemesa, 2, '0'); //Codigo de Ocurrencia de Remesa N(2)
      string += completarFinal(numPreImpreso, 10, ' '); //Nº DO DOCUMENTO A(10)
      string += completarInicio(dueDateInvoice, 6, '0'); // Fecha de vencimiento (invoice y/o Boleto Bancario) N(6)
      string += completarInicio(montoTotalInvoice, 13, '0'); //valorTítulo
      string += completarInicio(codigoBanco, 3, '0'); //codigoBanco N(3)
      string += '00000'; // AGÊNCIA COBRADORA N(5)
      string += completarFinal(codigoEspecieDoc, 2, ' '); //especie del Documento (puede ser DM=01 o DS=08) A(2)
      string += 'N'; //aceite (siempre sera N- no) A(1)
      string += completarInicio(dateInvoice, 6, '0'); //DATA DE EMISSÃO N(6)
      string += '  '; //instruccion_1 A(2)
      string += '  '; //instruccion_2 A(2)
      string += completarInicio(MORA_DIA, 13, '0'); //JUROS DE 1 DIA  N(13)
      string += completarInicio(complementoRegistro, 6, '0'); //fechaDescuento N(6)
      string += completarInicio(complementoRegistro, 13, '0'); //valorDescuento N(13)
      string += completarInicio(complementoRegistro, 13, '0'); //VALOR DO I.O.F. N(13)
      string += completarInicio(complementoRegistro, 13, '0'); //ABATIMENTO N(13)
      string += tipoCustomer; //CÓDIGO DE INSCRIÇÃO N(2)
      string += completarInicio(cnpjCustomer, 14, '0'); //cnpjPagador N(14)
      string += completarFinal(nomCustomer, 30, ' '); //nombrePagador A(30)
      string += completarInicio(complementoRegistro, 10, ' '); //Complemento de Registro A(10)
      string += completarFinal(addressCustomer, 40, ' '); //direccionPagador A(40)
      string += completarFinal(bairroCustomer, 12, ' '); //Bairro Pagador A(12)
      string += completarInicio(cepCustomer, 8, '0'); //cepPagador N(8)
      string += completarFinal(ciudadCustomer, 15, ' '); //ciudadPagador A(15)
      string += completarFinal(ufCustomer, 2, ' '); //ufPagador A(2)
      string += completarInicio(complementoRegistro, 30, ' '); //Sacador / Avalista  A(30)
      string += completarInicio(complementoRegistro, 4, ' '); // Complemento de Registro A(4)
      string += completarInicio(fecha_mora, 6, '0'); //DATA DE MORA N(6)
      string += '00'; //PRAZO N(2)
      string += completarFinal(complementoRegistro, 1, ' ');; //Complemento de Registro A(1)
      //NÚMERO SEQÜENCIAL N(6)

      return string;
    }

    function obtenerDetalleMulta() {
      try{
        var codMulta = 0;
        var fechaMulta = '';

        if(MULTA){
          MULTA = parseFloat(MULTA);
          if(MULTA <100){
            codMulta = 2;
            formatoFecha(dataVencimiento, 1);
            MULTA = parseFloat(MULTA).toFixed(2);
            MULTA = formatoMonto(MULTA);
          }
        }

        var string = "";
        string += '2'; //tipoRegistro
        string += completarInicio(codMulta, 1, '0') //Código de multa (Solo se admitirá porcentaje)
        string += completarInicio(formatoFechaMulta, 8, '0'); //Fecha de multa (Data de multa)
        string += completarInicio(MULTA, 13, '0'); //Multa
        string += completarFinal(complementoRegistro, 371, ' '); //Brancos
        //Secuencial N(6)
        return string;

      }catch (error) {
        log.error('ERROR', '[ obtenerDetalleMulta ]');
        libraryMail.sendemail(' [ obtenerDetalleMulta ] ' + error, LMRY_script);
      }
    }

    // Datos de la Factura
    function obtenerDetalleRegistroObli() {

      obtenerDatosInvoice();
      obtenerDatosCustomer();
      calcularInstallments();
      registroObligatorio = '\r\n' + obtenerDetalleRegistroObligatorio()+ obtenerDetalleMulta();

      return registroObligatorio;
    }


    function obtenerTrailerArchivo(contador) {
      var string = '';
      string += '9'; //tipoRegistro N(1)
      string += completarInicio(complementoRegistro, 393, ' '); //Complemento de Registro A(393)
      string += completarInicio(contador, 6, '0'); //NÚMERO SEQÜENCIAL N(6)

      return string;
    }

    function completarInicio(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = caracter + dato
      }
      if (dato.lentgh == cantMaxima) {
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        return dato;
      }
    }

    function completarFinal(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = dato + caracter
      }
      if (dato.lentgh == cantMaxima) {
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        return dato;
      }
    }

    //Datos de la transacción
    function obtenerDatosInvoice() {
    try{
      var recordInvoice = search.lookupFields({
        type: search.Type.INVOICE,
        id: ID_INVOICE,
        columns: ['subsidiary','entity', 'custbody_lmry_num_preimpreso', 'trandate', 'duedate', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount']
      });

      ID_CUSTOMER = recordInvoice.entity[0].value;

      numPreImpreso = recordInvoice.custbody_lmry_num_preimpreso;

      var trandateInvoice = recordInvoice.trandate;
      dateInvoice = formatoFecha(trandateInvoice);

      dataVencimiento = recordInvoice.duedate;
      if (dataVencimiento) {
        dueDateInvoice = formatoFecha(dataVencimiento); //DDMMAA
      }

      montoTotalInvoice = recordInvoice.fxamount;

      /******************************************************************+******************************************
      - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
        Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
      ***************************************************************************************************************/
      var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

      licenses = libraryMail.getLicenses(ID_SUBSIDIARY);

      if (libraryMail.getAuthorization(416,licenses) == true && tax_code_des == 'Latam - WHT Tax') {
        FLAG = true;
        var retencion = recordInvoice.custbody_lmry_wtax_amount;
        montoTotalInvoice = montoTotalInvoice - retencion;
        montoTotalInvoice = montoTotalInvoice.toFixed(2);
      }
      // ****************************************************************************************************************
      montoTotalInvoice = formatoMonto(montoTotalInvoice);

    }catch (error) {
      log.error('ERROR', '[ obtenerDatosInvoice ]');
      libraryMail.sendemail(' [ obtenerDatosInvoice ] ' + error, LMRY_script);
    }
    }

    // Datos del Customer
    function obtenerDatosCustomer() {
      try{
      if (ID_CUSTOMER != 0) {

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: ID_INVOICE,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: ID_CUSTOMER,
          columns: customer_columns
        });
        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson;

        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T' || typeCustomer == true) {
          var firtsName = recordCustomer.firstname
          var lastName = recordCustomer.lastname;
          nom_customer = firtsName + ' ' + lastName;
          tipoCustomer = '01';

        } else {
          nom_customer = recordCustomer.companyname;
          tipoCustomer = '02';

        }
        // NOMBRE DEL CLIENTE
        if (nom_customer) {
          nomCustomer = reemplazarCaracteresEspeciales(nom_customer);
        }

        //CNPJ DEL CLIENTE
        var cnpj_customer = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_customer = recordCustomer.vatregnumber;
        } else {
          cnpj_customer = customer_cnpj;
        }

        if (cnpj_customer)
          cnpjCustomer = formatoCNPJ(cnpj_customer);


        // DIRECCIÓN DEL CLIENTE
        //ADDRESS 1
        var billAdress1 = '';
        //LATAM - ADDRESS NUMBER
        var billAdress2 = '';
        //LATAM - ADDRESS REFERENCE
        var billAdress3 = '';
        // ADDRESS 2 (Barrio)
        var billAdress4 = '';
        // LATAM - CITY (Ciudad)
        var billAdress5 = '';
        // LATAM - PROVINCE ACRONYM
        var billAdress6 = '';
        // ZIP - es el CEP del customer
        var billAdress7 = '';
        // COUNTRY
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", ID_INVOICE],
            "AND", ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          //ADDRESS 1
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }

          //LATAM - ADDRESS NUMBER
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress2 == '' || billAdress2 == null) {
            billAdress2 = '';
          }

          //LATAM - ADDRESS REFERENCE
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          // ADDRESS 2 (Barrio)
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }
          bairroCustomer = billAdress4;
          bairroCustomer = reemplazarCaracteresEspeciales(bairroCustomer);

          // LATAM - CITY (Ciudad)
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }
          ciudadCustomer = billAdress5;
          ciudadCustomer = reemplazarCaracteresEspeciales(ciudadCustomer);

          // LATAM - PROVINCE ACRONYM
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }
          ufCustomer = billAdress6;
          ufCustomer = reemplazarCaracteresEspeciales(ufCustomer);

          // ZIP - es el CEP del customer
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }
          billAdress7 = billAdress7.replace(/[^0-9]/g, '');
          cepCustomer = billAdress7;
          cepCustomer = reemplazarCaracteresEspeciales(cepCustomer);

          // COUNTRY
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }
        }

        //Arma la direccion: ADDRESS 1    LATAM - ADDRESS NUMBER   LATAM - ADDRESS REFERENCE
        addressCustomer = billAdress1 + ' ' + billAdress2 + ' ' + billAdress3;
        addressCustomer = reemplazarCaracteresEspeciales(addressCustomer);

      }
    }catch (error) {
      log.error('ERROR', '[ obtenerDatosCustomer ]');
      libraryMail.sendemail(' [ obtenerDatosCustomer ] ' + error, LMRY_script);
    }
      return true;

    }

    function calcularInstallments(){
      try{
        if(ID_INST != '' && ID_INST!= null){
          //Nosso Número
          var codNosso = ID_INVOICE+ID_INST;
          NOSSO_COD = codNosso.toString();

          COD_EMPRESA = ID_INVOICE+'_'+ID_INST;
          if (DUEDATE_INST) {
            dataVencimiento = DUEDATE_INST;
            dueDateInvoice = formatoFecha(DUEDATE_INST);
          }
          montoTotalInvoice = AMOUNT_INST;

          //Cálculo de retención para installments
          var jsonInstallments = [];
          if (RETENCION_INST != '' && RETENCION_INST != null) {
            jsonInstallments = JSON.parse(RETENCION_INST);
          }

          if (Object.keys(jsonInstallments).length) {
            for (var idInstallment in jsonInstallments) {
              if(ID_INST == idInstallment){
                if (jsonInstallments[idInstallment]['wht'] && FLAG) {
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  montoTotalInvoice = Math.round((parseFloat(montoTotalInvoice) - parseFloat(retencion)) * 100) / 100;
                }
              }
            }
          }

          montoTotalInvoice = Number(montoTotalInvoice).toFixed(2);
          montoTotalInvoice = formatoMonto(montoTotalInvoice);

        }else{
          NOSSO_COD = ID_INVOICE.toString();
          COD_EMPRESA = ID_INVOICE;
        }

      }catch (error) {
        log.error('ERROR', '[ calcularInstallments ]');
        libraryMail.sendemail(' [ calcularInstallments ] ' + error, LMRY_script);
      }
    }

    function formatoFecha(fecha, opt) {

      var formatoFecha = '';
      fecha = format.parse({
        value: fecha,
        type: format.Type.DATE
      });

      var day = fecha.getDate();
      day = day.toString();
      if (day.length == 1) {
        day = '0' + day
      }

      var month = fecha.getMonth() + 1;
      month = month.toString();
      if (month.length == 1) {
        month = '0' + month
      }

      var year = fecha.getFullYear();
      year = year.toString();
      if(opt!= null && opt!= ''){
        formatoFechaMulta = day + month + year;
      }

      year = year.substring(2, 4);

      formatoFechaNameFile = year + month + day;
      formatoFecha = day + month + year;
      return formatoFecha;
    }

    function formatoMonto(monto) {
      var monto_invoice = '';
      monto_invoice = monto.replace(',', '');
      monto_invoice = monto_invoice.replace('.', '');

      return monto_invoice;
    }

    function search_folder() {
      try {
        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_arquivo_remessa'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - Arquivo Remessa" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - Arquivo Remessa']
            ]});

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - Arquivo Remessa');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }

          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({type: config.Type.COMPANY_PREFERENCES});

          // set field values
          varCompanyReference.setValue({fieldId: 'custscript_lmry_br_arquivo_remessa',value: varFolderId});

          // save changes to the Company Preferences page
          varCompanyReference.save();
        }
      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
      }
    }

    return {
      getInputData: getInputData,
      map: map,
      summarize: summarize
    };
  });
