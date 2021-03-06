import React, { useState } from "react";
import { capitalizeFirstLetter } from "../service";
import AppBar from "@material-ui/core/AppBar";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import TextField from "@material-ui/core/TextField";
import Chip from "@material-ui/core/Chip";
import Button from "@material-ui/core/Button";
import FormGroup from "@material-ui/core/FormGroup";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/Delete";
import WarningIcon from "@material-ui/icons/Warning";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import CloudUpload from "@material-ui/icons/CloudUpload";
import Check from "@material-ui/icons/Check";
import CircularProgress from "@material-ui/core/CircularProgress";
import Dropzone from "react-dropzone";
import { useSnackbar } from "notistack";
import { Annotate } from "../proto/annotation_pb_service";
import { AnnotationRequest, Annotation, Gene, Filter } from "../proto/annotation_pb";
import AnchorLink from "../../../../../components/common/AnchorLink";

import "./style.css";
const grpc = require("@improbable-eng/grpc-web").grpc;

const GeneGoOptions = [
  { label: "Biological Process", value: "biological_process" },
  { label: "Cellular Component", value: "cellular_component" },
  { label: "Molecular Function", value: "molecular_function" },
];

// const Pathways = [{ label: "Reactome", value: "reactome" }];

const GeneInputMethods = { Manual: 0, Import: 1 };

const VirusGenes = [
  "NSP1",
  "NSP7",
  "ORF8",
  "NSP10",
  "E",
  "N",
  "M",
  "NSP6",
  "ORF6",
  "ORF7A",
  "ORF9C",
  "NSP4",
  "NSP8",
  "NSP9",
  "ORF10",
  "NSP14",
  "S",
  "ORF3A",
  "NSP13",
  "ORF3B",
  "NSP5",
  "NSP12",
  "NSP2",
  "ORF9B",
  "NSP11",
  "NSP15",
];

const AnnotationForm = props => {
  const { enqueueSnackbar } = useSnackbar();
  const geneInputRef = React.createRef();
  const [genes, setGenes] = useState([]);
  const [currentGene, setCurrentGene] = useState("");
  const [annotations, setAnnotations] = useState([]);
  const [parents, setParents] = useState(0);
  const [goParents, setGOParents] = useState(1);
  const [pathways, setPathways] = useState(["reactome"]);
  const [includeSmallMolecules, setIncludeSmallMolecules] = useState(false);
  const [geneLevel, setGeneLevel] = useState(false);
  const [includeCodingRNA, setIncludeCodingRNA] = useState(false);
  const [includeNonCodingRNA, setIncludeNonCodingRNA] = useState(false);

  const [includeProtiens, setIncludeProtiens] = useState(true);

  const [includeCov, setIncludeCov] = useState(true);

  const [loading, setLoading] = useState(false);
  const [GOSubgroups, setGOSubgroups] = useState(["biological_process", "cellular_component", "molecular_function"]);
  const [geneInputMethod, setGeneInputMethod] = useState(GeneInputMethods.Manual);
  const [annotatePathwayWithBiogrid, setAnnotatePathwayWithBiogrid] = useState(false);

  const addGene = e => {
    const gene = e
      .trim()
      .toUpperCase()
      .split(" ")
      .filter(g => g);
    gene.some(g => genes.includes(g))
      ? enqueueSnackbar("Gene already exists", {
          variant: "warning",
          anchorOrigin: {
            vertical: "top",
            horizontal: "center",
          },
        })
      : setGenes([...genes, ...gene]);
    setCurrentGene("");
  };

  const toggleAnnotation = (annotation, e) => {
    if (annotation === "biogrid-interaction-annotation" && !geneLevel && e.target.checked) {
      e.target.checked = false;
    } else {
      const updated = e.target.checked ? [...annotations, annotation] : annotations.filter(a => a !== annotation);
      setAnnotations(updated);
    }
  };

  const toggleGoSubgroup = (subgroup, e) => {
    const updated = e.target.checked ? [...GOSubgroups, subgroup] : GOSubgroups.filter(s => s !== subgroup);
    setGOSubgroups(updated);
  };

  const togglePathways = (subgroup, e) => {
    const updated = e.target.checked ? [...pathways, subgroup] : pathways.filter(s => s !== subgroup);
    setPathways(updated);
  };

  const handleFileUpload = file => {
    const reader = new FileReader();
    reader.onload = () => {
      setGenes(reader.result.split("\n"));
      enqueueSnackbar("Genes imported!", {
        variant: "success",
        anchorOrigin: {
          vertical: "top",
          horizontal: "center",
        },
      });
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    setLoading(true);
    const annotationRequest = new AnnotationRequest();
    annotationRequest.setGenesList(
      genes.map(g => {
        const gene = new Gene();
        gene.setGenename(g);
        return gene;
      })
    );
    // Namespace and number of parents
    const namespace = new Filter();
    namespace.setFilter("namespace");
    namespace.setValue(GOSubgroups.join(" "));
    const nop = new Filter();
    nop.setFilter("parents");
    nop.setValue(parents.toString());
    const gl = new Filter();
    gl.setFilter("gene-level?");
    gl.setValue(capitalizeFirstLetter(geneLevel.toString()));

    const annList = annotations.map(sa => {
      const annotation = new Annotation();
      annotation.setFunctionname(sa);
      if (sa === "gene-go-annotation") {
        const ip = new Filter();
        annotation.setFiltersList([namespace, nop, gl]);
      } else if (sa === "gene-pathway-annotation") {
        const ps = new Filter();
        ps.setFilter("pathway");
        ps.setValue(pathways.join(" "));
        const ism = new Filter();
        ism.setFilter("include_sm");
        ism.setValue(capitalizeFirstLetter(includeSmallMolecules.toString()));
        const capb = new Filter();
        capb.setFilter("string?");
        const coding = new Filter();
        coding.setFilter("coding");
        coding.setValue(capitalizeFirstLetter(includeCodingRNA.toString()));
        const noncoding = new Filter();
        noncoding.setFilter("noncoding");
        noncoding.setValue(capitalizeFirstLetter(includeNonCodingRNA.toString()));
        annotation.setFiltersList([ps, gl, ism, capb, coding, noncoding]);
      } else if (sa === "biogrid-interaction-annotation") {
        const cov = new Filter();
        cov.setFilter("exclude-orgs");
        cov.setValue(includeCov ? "" : "2697049");

        const coding = new Filter();
        coding.setFilter("coding");
        coding.setValue(capitalizeFirstLetter(includeCodingRNA.toString()));
        const noncoding = new Filter();
        noncoding.setFilter("noncoding");
        noncoding.setValue(capitalizeFirstLetter(includeNonCodingRNA.toString()));
        annotation.setFiltersList([coding, noncoding, cov]);
      } else if (sa === "go-annotation") {
        const pars = new Filter();
        pars.setFilter("parents");
        pars.setValue(goParents.toString());
        annotation.setFiltersList([pars]);
      }
      return annotation;
    });

    const includeRNA = new Annotation();
    includeRNA.setFunctionname("include-rna");
    const coding = new Filter();
    coding.setFilter("coding");
    coding.setValue(capitalizeFirstLetter(includeCodingRNA.toString()));
    const noncoding = new Filter();
    noncoding.setFilter("noncoding");
    noncoding.setValue(capitalizeFirstLetter(includeNonCodingRNA.toString()));
    const protein = new Filter();
    includeRNA.setFiltersList([gl, coding, noncoding]);

    annotationRequest.setAnnotationsList(includeCodingRNA || includeNonCodingRNA ? [...annList, includeRNA] : annList);
    const requestProps = {
      request: annotationRequest,
      onEnd: ({ status, statusMessage, message: msg }) => {
        setLoading(false);
        if (status === grpc.Code.OK) {
          props.onResponse(msg.array[0].substr(msg.array[0].indexOf("id=") + 3));
        } else {
          if (statusMessage.includes("Gene Doesn't exist")) {
            const invalidGenes = statusMessage
              .split("`")[1]
              .split(",")
              .map(g => g.trim())
              .filter(g => g);
            setGenes(genes.filter(g => !invalidGenes.includes(g)));
            enqueueSnackbar("Gene not found!", {
              variant: "warning",
              anchorOrigin: {
                vertical: "top",
                horizontal: "center",
              },
            });
          } else {
            enqueueSnackbar(
              <div>
                <Typography variant="body2">An error occurred</Typography>
                <Typography variant="body2">{statusMessage}</Typography>
              </div>,
              {
                variant: "error",
                anchorOrigin: {
                  vertical: "top",
                  horizontal: "center",
                },
              }
            );
          }
        }
      },
    };

    props.serviceClient.unary(Annotate.Annotate, requestProps);
  };

  return (
    <div className="container form-wrapper">
      {/* Gene List */}
      <Typography variant="h6" gutterBottom>
        Input <AnchorLink href="http://www.genenames.org" label="HGNC" newTab /> Gene Symbols
      </Typography>
      <AppBar position="static" color="default" style={{ marginBottom: 15 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          value={geneInputMethod}
          onChange={(e, value) => {
            setGeneInputMethod(value);
          }}
          variant="fullWidth"
        >
          <Tab label="Input directly" key={GeneInputMethods.Manual} />
          <Tab label="Import from file" key={GeneInputMethods.Import} />
        </Tabs>
      </AppBar>
      {geneInputMethod === GeneInputMethods.Manual && (
        <TextField
          ref={geneInputRef}
          placeholder={genes.length ? "SARS-CoV-2 genes are now supported" : "Input gene name"}
          helperText="You may input space separated gene names and hit enter"
          fullWidth
          value={currentGene}
          variant="outlined"
          onChange={e => setCurrentGene(e.target.value)}
          onKeyPress={e => {
            if (e.key === "Enter") addGene(currentGene);
          }}
        />
      )}
      {geneInputMethod === GeneInputMethods.Import && (
        <Dropzone
          multiple={false}
          onDrop={files => {
            const file = files[0];
            handleFileUpload(file);
          }}
          style={{ marginBottom: 15 }}
        >
          {({ getRootProps, getInputProps, isDragActive }) => {
            return (
              <div
                {...getRootProps()}
                className={`dropzone ${isDragActive ? "dropzone--isActive" : ""}`}
                style={{
                  textAlign: "center",
                  padding: "30px",
                  border: "dashed 1px #90D4FF",
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload style={{ fontSize: "48px" }} />
                {isDragActive ? (
                  <Typography variant="h5" gutterBottom>
                    Drop file here...
                  </Typography>
                ) : (
                  <Typography variant="body1" gutterBottom>
                    Please make sure the file is a plain text file containing a gene name per line.
                  </Typography>
                )}
              </div>
            );
          }}
        </Dropzone>
      )}
      <div className="gene-list">
        {genes.map(g => (
          <Chip
            style={{ margin: 5 }}
            color={VirusGenes.includes(g) ? "secondary" : "primary"}
            key={g}
            label={g}
            onDelete={() => setGenes(genes.filter(f => f !== g))}
          />
        ))}
        {genes.length > 1 && (
          <IconButton aria-label="delete" color="secondary">
            <DeleteIcon onClick={e => setGenes([])} />
          </IconButton>
        )}
      </div>
      {/* Annotations */}
      <Typography variant="h6" gutterBottom>
        Annotations
      </Typography>
      <ul className="annotation-list">
        <li>
          <FormGroup row>
            <FormControlLabel
              control={<Checkbox color="primary" onChange={e => toggleAnnotation("gene-go-annotation", e)} />}
              label={<AnchorLink href="http://www.geneontology.org" label="Gene Ontology" newTab />}
            />
          </FormGroup>

          {annotations.includes("gene-go-annotation") && (
            <div className="annotation-parameters">
              <div className="parameter">
                <FormGroup row>
                  {GeneGoOptions.map(o => (
                    <FormControlLabel
                      key={o.label}
                      control={
                        <Checkbox
                          color="primary"
                          value={o.value}
                          defaultChecked={GOSubgroups.includes(o.value)}
                          onChange={e => toggleGoSubgroup(o.value, e)}
                        />
                      }
                      label={o.label}
                    />
                  ))}
                </FormGroup>
              </div>
              <div className="parameter">
                <TextField
                  label="Number of parents"
                  value={parents}
                  error={parents === "" || isNaN(parents)}
                  onChange={e => setParents(e.target.value)}
                  type="number"
                  variant="outlined"
                  helperText={
                    parents === "" || isNaN(parents) ? (
                      <Typography variant="body2" gutterBottom>
                        Number of parents needs to be a valid number
                      </Typography>
                    ) : null
                  }
                />
              </div>
            </div>
          )}
        </li>
        <li>
          <FormGroup row>
            <FormControlLabel
              control={<Checkbox color="primary" onChange={e => toggleAnnotation("gene-pathway-annotation", e)} />}
              label="Curated Pathways"
            />
          </FormGroup>
          {annotations.includes("gene-pathway-annotation") && (
            <div className="annotation-parameters">
              <div className="parameter">
                <FormControlLabel
                  control={
                    <Checkbox
                      color="primary"
                      value="reactome"
                      onChange={e => togglePathways("reactome", e)}
                      defaultChecked={pathways.includes("reactome")}
                    />
                  }
                  label={<AnchorLink href="http://www.reactome.org" label="Reactome" newTab />}
                />
              </div>
              <div className="parameter">
                <FormGroup row>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={includeSmallMolecules}
                        onChange={e => setIncludeSmallMolecules(e.target.checked)}
                        value="smallMolecules"
                        color="primary"
                      />
                    }
                    label="Small molecules"
                  />
                </FormGroup>
              </div>
              <div className="parameter">
                <FormGroup row>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={annotatePathwayWithBiogrid}
                        onChange={e => setAnnotatePathwayWithBiogrid(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Cross annotate with biogrid"
                  />
                </FormGroup>
              </div>
            </div>
          )}
        </li>
        <li>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox color="primary" onChange={e => toggleAnnotation("biogrid-interaction-annotation", e)} />
              }
              label="Biogrid Protien Interaction"
            />
          </FormGroup>
        </li>
      </ul>

      {/*Other Annotations*/}
      <span className="title">Other Annotations</span>
      <ul className="annotation-list">
        <li>
          <FormControlLabel
            control={<Checkbox color="primary" onChange={e => toggleAnnotation("go-annotation", e)} />}
            label="GO Term"
          />
          {annotations.includes("go-annotation") && (
            <div className="annotation-parameters">
              <div className="parameter">
                <TextField
                  label="Number of parents"
                  value={goParents}
                  error={goParents === "" || isNaN(goParents)}
                  onChange={e => setGOParents(e.target.value)}
                  type="number"
                  variant="outlined"
                  helperText={
                    goParents === "" || isNaN(goParents) ? (
                      <Typography variant="body2" gutterBottom>
                        Number of parents needs to be a valid number
                      </Typography>
                    ) : null
                  }
                />
              </div>
            </div>
          )}
        </li>
      </ul>

      <Typography variant="h6" gutterBottom>
        Include RNA
      </Typography>
      <FormControlLabel
        control={
          <Switch checked={includeCodingRNA} onChange={e => setIncludeCodingRNA(e.target.checked)} color="primary" />
        }
        label="Coding RNA"
      />
      <FormControlLabel
        control={
          <Switch
            checked={includeNonCodingRNA}
            onChange={e => setIncludeNonCodingRNA(e.target.checked)}
            color="primary"
          />
        }
        label="Non-coding RNA"
      />
      <br />
      <br />
      <FormControlLabel
        control={<Switch checked={geneLevel} onChange={e => setGeneLevel(e.target.checked)} color="primary" />}
        label="Gene Only"
      />
      <br />
      <br />
      <Typography variant="h6" gutterBottom>
        SARS-CoV-2
      </Typography>
      <FormControlLabel
        control={<Switch checked={includeCov} onChange={e => setIncludeCov(e.target.checked)} color="primary" />}
        label="Include SARS-CoV-2"
      />
      {annotatePathwayWithBiogrid && (
        <div style={{ backgroundColor: "beige", border: "solid 1px orange", padding: 10 }}>
          <Typography variant="h6" gutterBottom>
            <WarningIcon style={{ marginRight: 10, color: "orange" }} /> Cross annotation will increase the size
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            If the result is too large, you might have difficulties visualizing it.
          </Typography>
        </div>
      )}
      <div className="actions">
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={!annotations.length || !genes.length || loading}
        >
          {loading ? (
            <CircularProgress color="inherit" size={24} style={{ marginRight: 15 }} />
          ) : (
            <Check style={{ marginRight: 15 }} />
          )}
          {loading ? " Processing annotation request ..." : " Submit"}
        </Button>
      </div>
    </div>
  );
};

export default AnnotationForm;
